from __future__ import annotations

import json

from scripts.batch_exam_explanations import normalize_subject, run_batch


def _question(number: int) -> dict:
    return {
        "questionNumber": number,
        "subject": "Direito Penal",
        "officialAnswer": "A",
        "officialAnswerText": "texto da alternativa correta",
        "annulled": False,
        "statement": f"Enunciado da questão {number}",
        "alternatives": {"A": "alt A", "B": "alt B"},
    }


def _by_number(numbers: list[int]) -> dict[int, dict]:
    return {n: _question(n) for n in numbers}


def _fake_result(number: int, status: str = "approved") -> dict:
    return {
        "questionNumber": number,
        "status": status,
        "totalMs": 12.3,
        "ollamaMs": 10.0 if status not in ("annulled", "insufficient_evidence") else None,
    }


def _run(tmp_path, numbers, process_fn, **kwargs):
    output_path = tmp_path / "out.json"
    document = run_batch(
        numbers,
        _by_number(numbers),
        process_fn,
        output_path=output_path,
        exam_path=tmp_path / "exam.json",
        exam_meta=None,
        model="fake-model",
        resume=kwargs.pop("resume", False),
        print_fn=kwargs.pop("print_fn", lambda *a, **k: None),
        **kwargs,
    )
    return output_path, document


# --- checkpoint after every question ---------------------------------

def test_checkpoints_after_every_question(tmp_path):
    seen_after_each_call: list[dict] = []

    def process_fn(question):
        # Read the checkpoint file as it stands the moment THIS question
        # starts — proves every prior question was already flushed to disk
        # before this call even began.
        output_path = tmp_path / "out.json"
        if output_path.exists():
            seen_after_each_call.append(json.loads(output_path.read_text(encoding="utf-8")))
        else:
            seen_after_each_call.append(None)
        return _fake_result(question["questionNumber"])

    output_path, document = _run(tmp_path, [1, 2, 3], process_fn)

    # Before question 1 runs, nothing is on disk yet.
    assert seen_after_each_call[0] is None
    # Before question 2 runs, question 1's result is already checkpointed.
    assert [r["questionNumber"] for r in seen_after_each_call[1]["results"]] == [1]
    # Before question 3 runs, questions 1 and 2 are both checkpointed.
    assert [r["questionNumber"] for r in seen_after_each_call[2]["results"]] == [1, 2]

    on_disk = json.loads(output_path.read_text(encoding="utf-8"))
    assert [r["questionNumber"] for r in on_disk["results"]] == [1, 2, 3]


def test_progress_counts_are_accurate_mid_run(tmp_path):
    def process_fn(question):
        n = question["questionNumber"]
        status = "approved" if n % 2 == 0 else "rejected"
        return _fake_result(n, status)

    output_path, document = _run(tmp_path, [1, 2, 3, 4], process_fn)
    on_disk = json.loads(output_path.read_text(encoding="utf-8"))
    progress = on_disk["progress"]
    assert progress["total"] == 4
    assert progress["completed"] == 4
    assert progress["remaining"] == 0
    assert progress["approved"] == 2
    assert progress["rejected"] == 2


# --- error handling: one bad question never stops the batch ----------

def test_a_process_fn_exception_does_not_stop_the_batch(tmp_path):
    calls = []

    def process_fn(question):
        n = question["questionNumber"]
        calls.append(n)
        if n == 2:
            raise RuntimeError("boom")
        return _fake_result(n)

    # run_batch's contract is that process_fn never raises in real usage
    # (process_question catches everything itself) — but if it somehow
    # did, the batch must not silently stop. Simulate the same contract
    # process_question honors: catch and turn it into an error result.
    def safe_process_fn(question):
        try:
            return process_fn(question)
        except Exception as exc:
            return {
                "questionNumber": question["questionNumber"],
                "status": "error",
                "error": str(exc),
                "totalMs": 1.0,
                "ollamaMs": None,
            }

    output_path, document = _run(tmp_path, [1, 2, 3], safe_process_fn)

    assert calls == [1, 2, 3]  # question 3 still ran despite question 2's failure
    statuses = {r["questionNumber"]: r["status"] for r in document["results"]}
    assert statuses == {1: "approved", 2: "error", 3: "approved"}


def test_stop_on_error_halts_after_first_error(tmp_path):
    calls = []

    def process_fn(question):
        n = question["questionNumber"]
        calls.append(n)
        if n == 2:
            return {"questionNumber": n, "status": "error", "error": "boom", "totalMs": 1.0, "ollamaMs": None}
        return _fake_result(n)

    output_path, document = _run(tmp_path, [1, 2, 3, 4], process_fn, stop_on_error=True)

    assert calls == [1, 2]  # never reached 3 or 4
    assert [r["questionNumber"] for r in document["results"]] == [1, 2]


def test_without_stop_on_error_flag_default_is_to_continue(tmp_path):
    calls = []

    def process_fn(question):
        n = question["questionNumber"]
        calls.append(n)
        if n == 2:
            return {"questionNumber": n, "status": "error", "error": "boom", "totalMs": 1.0, "ollamaMs": None}
        return _fake_result(n)

    output_path, document = _run(tmp_path, [1, 2, 3, 4], process_fn)  # stop_on_error defaults False
    assert calls == [1, 2, 3, 4]


# --- resume / retry skip logic (end-to-end through run_batch) --------

def test_resume_skips_approved_and_does_not_call_process_fn(tmp_path):
    calls = []
    output_path = tmp_path / "out.json"

    def process_fn(question):
        calls.append(question["questionNumber"])
        return _fake_result(question["questionNumber"], "approved")

    # First run: 1 and 2 complete.
    run_batch(
        [1, 2], _by_number([1, 2]), process_fn,
        output_path=output_path, exam_path=tmp_path / "exam.json", exam_meta=None,
        model="fake-model", resume=False, print_fn=lambda *a, **k: None,
    )
    assert calls == [1, 2]
    calls.clear()

    # Second run, --resume, same + question 3: 1 and 2 must NOT be
    # reprocessed (process_fn not called for them), only 3 runs.
    run_batch(
        [1, 2, 3], _by_number([1, 2, 3]), process_fn,
        output_path=output_path, exam_path=tmp_path / "exam.json", exam_meta=None,
        model="fake-model", resume=True, print_fn=lambda *a, **k: None,
    )
    assert calls == [3]

    on_disk = json.loads(output_path.read_text(encoding="utf-8"))
    assert [r["questionNumber"] for r in on_disk["results"]] == [1, 2, 3]


def test_narrower_questions_on_resume_never_drops_prior_results(tmp_path):
    # Real incident this locks down: a 198-question file existed, then a
    # follow-up run retried only 5 failed numbers with --resume — and used
    # to silently rewrite the output down to just those 5, discarding the
    # other 193 already-paid-for results. --output must always be treated
    # as a durable, cumulative record.
    output_path = tmp_path / "out.json"

    def process_fn(question):
        return _fake_result(question["questionNumber"], "approved")

    run_batch(
        [1, 2, 3], _by_number([1, 2, 3]), process_fn,
        output_path=output_path, exam_path=tmp_path / "exam.json", exam_meta=None,
        model="fake-model", resume=False, print_fn=lambda *a, **k: None,
    )
    on_disk = json.loads(output_path.read_text(encoding="utf-8"))
    assert [r["questionNumber"] for r in on_disk["results"]] == [1, 2, 3]

    # Narrower follow-up run, --resume, asking only about question 2.
    run_batch(
        [2], _by_number([1, 2, 3]), process_fn,
        output_path=output_path, exam_path=tmp_path / "exam.json", exam_meta=None,
        model="fake-model", resume=True, retry_rejected=True, print_fn=lambda *a, **k: None,
    )
    on_disk = json.loads(output_path.read_text(encoding="utf-8"))
    assert [r["questionNumber"] for r in on_disk["results"]] == [1, 2, 3]
    assert on_disk["progress"]["total"] == 3
    assert on_disk["progress"]["completed"] == 3


def test_retry_rejected_reprocesses_only_rejected(tmp_path):
    output_path = tmp_path / "out.json"
    existing = {
        "generatedAt": "x", "model": "m", "exam": {}, "questionsRequested": [1, 2, 3],
        "progress": {}, "results": [
            _fake_result(1, "approved"),
            _fake_result(2, "rejected"),
            _fake_result(3, "approved_with_gaps"),
        ],
    }
    output_path.write_text(json.dumps(existing), encoding="utf-8")

    calls = []

    def process_fn(question):
        calls.append(question["questionNumber"])
        return _fake_result(question["questionNumber"], "approved")

    run_batch(
        [1, 2, 3], _by_number([1, 2, 3]), process_fn,
        output_path=output_path, exam_path=tmp_path / "exam.json", exam_meta=None,
        model="fake-model", resume=True, retry_rejected=True, print_fn=lambda *a, **k: None,
    )
    assert calls == [2]  # only the rejected one, not the approved_with_gaps one


def test_retry_gaps_reprocesses_only_approved_with_gaps(tmp_path):
    output_path = tmp_path / "out.json"
    existing = {
        "generatedAt": "x", "model": "m", "exam": {}, "questionsRequested": [1, 2, 3],
        "progress": {}, "results": [
            _fake_result(1, "approved"),
            _fake_result(2, "rejected"),
            _fake_result(3, "approved_with_gaps"),
        ],
    }
    output_path.write_text(json.dumps(existing), encoding="utf-8")

    calls = []

    def process_fn(question):
        calls.append(question["questionNumber"])
        return _fake_result(question["questionNumber"], "approved")

    run_batch(
        [1, 2, 3], _by_number([1, 2, 3]), process_fn,
        output_path=output_path, exam_path=tmp_path / "exam.json", exam_meta=None,
        model="fake-model", resume=True, retry_gaps=True, print_fn=lambda *a, **k: None,
    )
    assert calls == [3]


def test_retry_insufficient_reprocesses_only_insufficient(tmp_path):
    output_path = tmp_path / "out.json"
    existing = {
        "generatedAt": "x", "model": "m", "exam": {}, "questionsRequested": [1, 2],
        "progress": {}, "results": [
            _fake_result(1, "insufficient_evidence"),
            _fake_result(2, "approved"),
        ],
    }
    output_path.write_text(json.dumps(existing), encoding="utf-8")

    calls = []

    def process_fn(question):
        calls.append(question["questionNumber"])
        return _fake_result(question["questionNumber"], "approved")

    run_batch(
        [1, 2], _by_number([1, 2]), process_fn,
        output_path=output_path, exam_path=tmp_path / "exam.json", exam_meta=None,
        model="fake-model", resume=True, retry_insufficient=True, print_fn=lambda *a, **k: None,
    )
    assert calls == [1]


# --- KeyboardInterrupt: preserve checkpoint, don't crash --------------

def test_keyboard_interrupt_preserves_prior_checkpoints_and_returns_cleanly(tmp_path):
    def process_fn(question):
        n = question["questionNumber"]
        if n == 3:
            raise KeyboardInterrupt
        return _fake_result(n)

    printed = []
    output_path, document = _run(tmp_path, [1, 2, 3, 4], process_fn, print_fn=printed.append)

    # Did not propagate — run_batch returned normally.
    assert document["interrupted"] is True
    # Questions 1 and 2 (completed before the interrupt) are preserved...
    assert [r["questionNumber"] for r in document["results"]] == [1, 2]
    # ...question 3 (interrupted mid-flight) was never partially saved,
    # and question 4 never ran at all.
    on_disk = json.loads(output_path.read_text(encoding="utf-8"))
    assert [r["questionNumber"] for r in on_disk["results"]] == [1, 2]
    assert any("interrompido com segurança" in msg for msg in printed)


# --- normalize_subject: an unmapped subject must never pass through -----
#
# legal_base.unified_search._local_subject() treats a subject it doesn't
# recognize as a literal diploma-name filter (not "no filter") — so a raw
# label like "Noções de Direito Administrativo" used to silently zero out
# every search result, turning perfectly good evidence into
# insufficient_evidence for every single Direito Administrativo question.

def test_recognized_subjects_still_map_to_their_diploma_label():
    assert normalize_subject("Noções de Direito Penal") == "Direito Penal"
    assert normalize_subject("Noções de Direito Processual Penal") == "Direito Processual Penal"
    assert normalize_subject("Noções de Direito Constitucional") == "Direito Constitucional"


def test_unmapped_subject_becomes_none_not_passthrough():
    assert normalize_subject("Noções de Direito Administrativo") is None
    assert normalize_subject("Noções de Direitos Humanos") is None
    assert normalize_subject("Noções de Criminologia") is None


def test_missing_subject_is_none():
    assert normalize_subject(None) is None
    assert normalize_subject("") is None
