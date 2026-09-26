from __future__ import annotations

import json
import os
import re
import tempfile
from pathlib import Path

# Pure, Ollama-free helpers for worker/scripts/batch_exam_explanations.py:
# question-range parsing, crash-safe atomic JSON writes, and a simple
# same-machine lockfile. Nothing here touches retrieval/coverage/
# compaction/model/legal logic — this is purely about running a batch
# robustly (checkpoint, resume, retry, don't corrupt the output file).

_RANGE_TOKEN = re.compile(r"^(\d+)(?:-(\d+))?$")


def parse_question_spec(spec: str) -> list[int]:
    """Parses "38,43,45" / "31-70" / "31-40,45,52-60" into a sorted list of
    unique question numbers. Deterministic regardless of input order or
    overlapping ranges — duplicates always collapse, output is always
    ascending.
    """
    numbers: set[int] = set()
    for raw_token in spec.split(","):
        token = raw_token.strip()
        if not token:
            continue
        match = _RANGE_TOKEN.match(token)
        if not match:
            raise ValueError(f"trecho inválido: {token!r}")
        start = int(match.group(1))
        end = int(match.group(2)) if match.group(2) is not None else start
        if end < start:
            raise ValueError(f"intervalo invertido: {token!r}")
        numbers.update(range(start, end + 1))
    return sorted(numbers)


# Statuses that are ALWAYS treated as done — no retry flag ever
# reprocesses them; they only go away if the output file itself is
# deleted or the run skips --resume entirely.
_ALWAYS_TERMINAL = {"approved", "annulled"}

# Every other known status has a matching --retry-<x> flag that, when
# passed, allows --resume to reprocess it anyway. Without the flag, these
# behave exactly like _ALWAYS_TERMINAL under --resume (the "sem flags de
# retry, --resume preserva os resultados existentes" rule) — the flags
# only ever carve out exceptions, never force MORE skipping.
_RETRY_FLAG_FOR_STATUS = {
    "rejected": "retry_rejected",
    "approved_with_gaps": "retry_gaps",
    "insufficient_evidence": "retry_insufficient",
    "error": "retry_error",
}


def should_reprocess_status(
    status: str | None,
    *,
    retry_rejected: bool = False,
    retry_gaps: bool = False,
    retry_insufficient: bool = False,
    retry_error: bool = False,
) -> bool:
    """Whether an EXISTING result (found via --resume) should be
    regenerated this run. `status` is the status recorded from a previous
    run. Unknown/missing status is treated as "not actually done" and is
    always reprocessed (safer than silently skipping something we don't
    recognize).
    """
    if status in _ALWAYS_TERMINAL:
        return False
    flag_name = _RETRY_FLAG_FOR_STATUS.get(status)
    if flag_name is None:
        return True  # unrecognized status — reprocess rather than trust it
    return {
        "retry_rejected": retry_rejected,
        "retry_gaps": retry_gaps,
        "retry_insufficient": retry_insufficient,
        "retry_error": retry_error,
    }[flag_name]


def atomic_write_json(path: Path, data: dict) -> None:
    """Writes `data` as JSON to `path` without ever leaving a partial or
    corrupted file behind: write to a temp file in the same directory
    (so the final rename is on the same filesystem), fsync it, then
    os.replace (atomic on POSIX) over the real path. A crash or Ctrl+C at
    any point either leaves the OLD complete file untouched, or the NEW
    complete file in place — never something half-written.
    """
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp_name = tempfile.mkstemp(dir=str(path.parent), prefix=f".{path.name}.", suffix=".tmp")
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
            f.flush()
            os.fsync(f.fileno())
        os.replace(tmp_name, path)
    except BaseException:
        try:
            os.unlink(tmp_name)
        except OSError:
            pass
        raise


def _pid_is_alive(pid: int) -> bool:
    try:
        os.kill(pid, 0)
    except ProcessLookupError:
        return False
    except PermissionError:
        return True  # process exists, just owned by someone else
    except OSError:
        return False
    return True


class BatchLock:
    """A simple same-machine lockfile (`<output>.lock`) so two batch runs
    never write the same --output concurrently. Not a distributed lock,
    not meant to be — just enough to catch the common "forgot a previous
    run was still going" mistake. A lock whose recorded PID is no longer
    alive is treated as stale and silently reclaimed.
    """

    def __init__(self, output_path: Path):
        self.lock_path = Path(str(output_path) + ".lock")
        self._acquired = False

    def acquire(self) -> None:
        if self.lock_path.exists():
            pid = None
            try:
                info = json.loads(self.lock_path.read_text(encoding="utf-8"))
                pid = info.get("pid")
            except (json.JSONDecodeError, OSError):
                pid = None
            if isinstance(pid, int) and _pid_is_alive(pid):
                raise SystemExit(
                    f"Já existe um processo escrevendo em {self.lock_path.with_suffix('')} "
                    f"(pid {pid} ainda ativo). Abortando para não corromper o arquivo. "
                    f"Se tiver certeza de que não há outro processo rodando, apague "
                    f"{self.lock_path} manualmente e tente de novo."
                )
            # Stale lock (process no longer alive, or unreadable) — safe to reclaim.

        self.lock_path.write_text(
            json.dumps({"pid": os.getpid()}),
            encoding="utf-8",
        )
        self._acquired = True

    def release(self) -> None:
        if self._acquired:
            try:
                self.lock_path.unlink()
            except FileNotFoundError:
                pass
            self._acquired = False

    def __enter__(self) -> "BatchLock":
        self.acquire()
        return self

    def __exit__(self, *exc_info) -> None:
        self.release()
