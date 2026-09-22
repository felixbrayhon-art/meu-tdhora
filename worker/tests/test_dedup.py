from tests.fakes import FakeFirestoreClient

from lib.dedup import dedup_internal, fetch_existing_keys, split_by_existing


def make_q(source: str, external_id: str, content_hash: str, statement: str = "x", warnings=None) -> dict:
    return {
        "source": source,
        "externalId": external_id,
        "contentHash": content_hash,
        "statement": statement,
        "warnings": warnings or [],
    }


def test_internal_duplicate_by_source_and_external_id():
    qs = [make_q("fc_concursos", "1", "hashA"), make_q("fc_concursos", "1", "hashA")]
    unique, removed = dedup_internal(qs)
    assert len(unique) == 1
    assert removed == 1


def test_internal_duplicate_by_content_hash_with_different_external_id():
    qs = [make_q("fc_concursos", "1", "hashA"), make_q("fc_concursos", "2", "hashA")]
    unique, removed = dedup_internal(qs)
    assert len(unique) == 1
    assert removed == 1


def test_no_duplicates_survive_intact():
    qs = [make_q("fc_concursos", "1", "hashA"), make_q("fc_concursos", "2", "hashB")]
    unique, removed = dedup_internal(qs)
    assert len(unique) == 2
    assert removed == 0


def test_duplicate_against_existing_by_content_hash():
    db = FakeFirestoreClient(
        seed={"questions": {"old-doc": {"source": "fc_concursos", "externalId": "999", "contentHash": "hashA"}}}
    )
    existing_pairs, existing_hashes = fetch_existing_keys(db)
    new_qs, existing_count = split_by_existing([make_q("fc_concursos", "1", "hashA")], existing_pairs, existing_hashes)
    assert existing_count == 1
    assert new_qs == []


def test_duplicate_against_existing_by_source_and_external_id():
    # Same source+externalId as an existing doc, but a DIFFERENT contentHash
    # (e.g. the statement was re-extracted slightly differently) — still a duplicate.
    db = FakeFirestoreClient(
        seed={"questions": {"old-doc": {"source": "fc_concursos", "externalId": "1", "contentHash": "some-other-hash"}}}
    )
    existing_pairs, existing_hashes = fetch_existing_keys(db)
    new_qs, existing_count = split_by_existing([make_q("fc_concursos", "1", "hashA")], existing_pairs, existing_hashes)
    assert existing_count == 1
    assert new_qs == []


def test_existing_duplicate_check_also_covers_pending_drafts():
    db = FakeFirestoreClient(
        seed={"question_drafts": {"draft-doc": {"source": "fc_concursos", "externalId": "1", "contentHash": "hashA"}}}
    )
    existing_pairs, existing_hashes = fetch_existing_keys(db)
    new_qs, existing_count = split_by_existing([make_q("fc_concursos", "1", "hashA")], existing_pairs, existing_hashes)
    assert existing_count == 1
    assert new_qs == []


def test_genuinely_new_question_passes_through():
    db = FakeFirestoreClient(
        seed={"questions": {"old-doc": {"source": "fc_concursos", "externalId": "999", "contentHash": "unrelated-hash"}}}
    )
    existing_pairs, existing_hashes = fetch_existing_keys(db)
    new_qs, existing_count = split_by_existing([make_q("fc_concursos", "1", "hashA")], existing_pairs, existing_hashes)
    assert existing_count == 0
    assert len(new_qs) == 1
