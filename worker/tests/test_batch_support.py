from __future__ import annotations

import json
import os

import pytest

from scripts.batch_support import (
    BatchLock,
    atomic_write_json,
    parse_question_spec,
    should_reprocess_status,
)


# --- parse_question_spec --------------------------------------------------

def test_parse_simple_comma_list():
    assert parse_question_spec("38,43,45") == [38, 43, 45]


def test_parse_range():
    assert parse_question_spec("31-70") == list(range(31, 71))


def test_parse_mixed_ranges_and_singles():
    assert parse_question_spec("31-40,45,52-60") == sorted(
        set(range(31, 41)) | {45} | set(range(52, 61))
    )


def test_parse_removes_duplicates():
    assert parse_question_spec("38,38,40-42,41") == [38, 40, 41, 42]


def test_parse_is_order_independent():
    assert parse_question_spec("45,38,43") == parse_question_spec("38,43,45") == [38, 43, 45]


def test_parse_ignores_stray_whitespace():
    assert parse_question_spec(" 38 , 43 , 45 ") == [38, 43, 45]


def test_parse_rejects_invalid_token():
    with pytest.raises(ValueError):
        parse_question_spec("38,abc,45")


def test_parse_rejects_inverted_range():
    with pytest.raises(ValueError):
        parse_question_spec("70-31")


def test_parse_ignores_empty_tokens():
    assert parse_question_spec("38,,43,") == [38, 43]


# --- should_reprocess_status ----------------------------------------------

def test_approved_and_annulled_never_reprocessed():
    assert should_reprocess_status("approved") is False
    assert should_reprocess_status("annulled") is False
    # Even with every retry flag on — these two are always terminal.
    assert should_reprocess_status(
        "approved", retry_rejected=True, retry_gaps=True, retry_insufficient=True, retry_error=True
    ) is False
    assert should_reprocess_status(
        "annulled", retry_rejected=True, retry_gaps=True, retry_insufficient=True, retry_error=True
    ) is False


def test_without_any_retry_flag_resume_preserves_everything():
    for status in ("rejected", "approved_with_gaps", "insufficient_evidence", "error"):
        assert should_reprocess_status(status) is False


def test_retry_rejected_only_affects_rejected():
    assert should_reprocess_status("rejected", retry_rejected=True) is True
    assert should_reprocess_status("approved_with_gaps", retry_rejected=True) is False
    assert should_reprocess_status("insufficient_evidence", retry_rejected=True) is False
    assert should_reprocess_status("error", retry_rejected=True) is False


def test_retry_gaps_only_affects_approved_with_gaps():
    assert should_reprocess_status("approved_with_gaps", retry_gaps=True) is True
    assert should_reprocess_status("rejected", retry_gaps=True) is False
    assert should_reprocess_status("insufficient_evidence", retry_gaps=True) is False


def test_retry_insufficient_only_affects_insufficient_evidence():
    assert should_reprocess_status("insufficient_evidence", retry_insufficient=True) is True
    assert should_reprocess_status("rejected", retry_insufficient=True) is False
    assert should_reprocess_status("approved_with_gaps", retry_insufficient=True) is False


def test_retry_flags_can_combine():
    assert should_reprocess_status("rejected", retry_rejected=True, retry_gaps=True) is True
    assert should_reprocess_status("approved_with_gaps", retry_rejected=True, retry_gaps=True) is True
    assert should_reprocess_status("insufficient_evidence", retry_rejected=True, retry_gaps=True) is False


def test_unknown_status_is_always_reprocessed():
    assert should_reprocess_status(None) is True
    assert should_reprocess_status("some_future_status") is True


# --- atomic_write_json -----------------------------------------------------

def test_atomic_write_produces_valid_readable_json(tmp_path):
    path = tmp_path / "out.json"
    atomic_write_json(path, {"a": 1, "b": [1, 2, 3]})
    assert json.loads(path.read_text(encoding="utf-8")) == {"a": 1, "b": [1, 2, 3]}


def test_atomic_write_leaves_no_tmp_files_behind(tmp_path):
    path = tmp_path / "out.json"
    atomic_write_json(path, {"a": 1})
    leftovers = [p for p in tmp_path.iterdir() if p.name != "out.json"]
    assert leftovers == []


def test_atomic_write_overwrites_without_corrupting_on_success(tmp_path):
    path = tmp_path / "out.json"
    atomic_write_json(path, {"version": 1})
    atomic_write_json(path, {"version": 2})
    assert json.loads(path.read_text(encoding="utf-8")) == {"version": 2}


def test_failed_write_does_not_touch_existing_file(tmp_path, monkeypatch):
    path = tmp_path / "out.json"
    atomic_write_json(path, {"version": 1})

    def _boom(*args, **kwargs):
        raise RuntimeError("simulated failure mid-write")

    monkeypatch.setattr("json.dump", _boom)
    with pytest.raises(RuntimeError):
        atomic_write_json(path, {"version": 2})

    # The old, complete file must still be intact — never half-written.
    assert json.loads(path.read_text(encoding="utf-8")) == {"version": 1}
    leftovers = [p for p in tmp_path.iterdir() if p.name != "out.json"]
    assert leftovers == []  # temp file was cleaned up, not left corrupted on disk


# --- BatchLock ---------------------------------------------------------

def test_lock_blocks_a_second_instance_while_holder_is_alive(tmp_path):
    output_path = tmp_path / "out.json"
    lock_a = BatchLock(output_path)
    lock_a.acquire()  # records this test process's own (real, alive) PID
    try:
        lock_b = BatchLock(output_path)
        with pytest.raises(SystemExit):
            lock_b.acquire()
    finally:
        lock_a.release()


def test_lock_can_be_reacquired_after_release(tmp_path):
    output_path = tmp_path / "out.json"
    lock_a = BatchLock(output_path)
    lock_a.acquire()
    lock_a.release()

    lock_b = BatchLock(output_path)
    lock_b.acquire()  # must not raise — the previous lock is gone
    lock_b.release()


def test_stale_lock_with_dead_pid_is_reclaimed(tmp_path):
    output_path = tmp_path / "out.json"
    lock_path = tmp_path / "out.json.lock"
    # A PID essentially guaranteed not to be alive in this test run.
    dead_pid = 2**30
    lock_path.write_text(json.dumps({"pid": dead_pid}), encoding="utf-8")

    lock = BatchLock(output_path)
    lock.acquire()  # must not raise — stale lock is reclaimed
    lock.release()


def test_lock_release_removes_the_lock_file(tmp_path):
    output_path = tmp_path / "out.json"
    lock = BatchLock(output_path)
    lock.acquire()
    assert (tmp_path / "out.json.lock").exists()
    lock.release()
    assert not (tmp_path / "out.json.lock").exists()


def test_lock_as_context_manager(tmp_path):
    output_path = tmp_path / "out.json"
    with BatchLock(output_path):
        assert (tmp_path / "out.json.lock").exists()
    assert not (tmp_path / "out.json.lock").exists()
