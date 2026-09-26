from __future__ import annotations

from .models import DiscoveredDocument, ExamPair


def _group_key(doc: DiscoveredDocument) -> tuple:
    # Deliberately NOT keyed by role: FGV's own pages frequently publish
    # one gabarito block per role-scoped page with no Indent1 role line
    # of its own (the page itself is already scoped to that one role),
    # so a gabarito document's `role` is often None even though it only
    # ever applies to the single role that page covers. Role compatibility
    # is instead checked per-candidate below (None means "applies to
    # every role in this group", exactly like test_type=None already
    # means "applies to every testType").
    return (doc.board, doc.institution, doc.year)


def _role_compatible(candidate_role: str | None, exam_role: str | None) -> bool:
    return candidate_role is None or candidate_role == exam_role


def pair_documents(documents: list[DiscoveredDocument]) -> list[ExamPair]:
    """Deterministically pairs each exam document with the answer-key
    document governing it, purely from metadata (board/institution/
    role/year/testType) — never content, never an LLM. Grouping is by
    (board, institution, role, year); within a group, every "exam"
    document must find exactly one usable answer key:

      - an "answer_key_final" present for the group -> status "ready"
        (this is the ONLY status commit_to_firestore.py may import from)
      - only an "answer_key_preliminary" present -> "waiting_final_key"
        (never eligible for import; not an error, just not final yet)
      - neither present, or more than one candidate answer key of the
        SAME type in the group -> "needs_attention" (ambiguous; a human
        decides, this pipeline never guesses)

    A group's answer key is almost always NOT testType-specific (FGV
    typically publishes one gabarito PDF covering every "Tipo N" via a
    table) — so an answer key with test_type=None pairs with every exam
    testType in its group; an answer key that DOES carry a testType only
    pairs with the matching exam testType, and a group mixing both
    shapes is ambiguous (needs_attention) rather than guessed at.
    """
    groups: dict[tuple, list[DiscoveredDocument]] = {}
    for doc in documents:
        groups.setdefault(_group_key(doc), []).append(doc)

    pairs: list[ExamPair] = []

    for (board, institution, year), docs in groups.items():
        exams = [d for d in docs if d.document_type == "exam"]
        finals = [d for d in docs if d.document_type == "answer_key_final"]
        prelims = [d for d in docs if d.document_type == "answer_key_preliminary"]

        for exam_doc in exams:
            role = exam_doc.role
            candidates_final = [
                k
                for k in finals
                if (k.test_type is None or k.test_type == exam_doc.test_type)
                and _role_compatible(k.role, role)
            ]

            if len(candidates_final) == 1:
                pairs.append(
                    ExamPair(
                        board=board, institution=institution, role=role, year=year,
                        test_type=exam_doc.test_type, exam_doc=exam_doc,
                        answer_key_doc=candidates_final[0], status="ready", reason=None,
                    )
                )
                continue

            if len(candidates_final) > 1:
                pairs.append(
                    ExamPair(
                        board=board, institution=institution, role=role, year=year,
                        test_type=exam_doc.test_type, exam_doc=exam_doc, answer_key_doc=None,
                        status="needs_attention",
                        reason=f"{len(candidates_final)} candidate answer_key_final documents match this exam — ambiguous",
                    )
                )
                continue

            # No final key yet — is there at least a preliminary one?
            candidates_prelim = [
                k
                for k in prelims
                if (k.test_type is None or k.test_type == exam_doc.test_type)
                and _role_compatible(k.role, role)
            ]
            if len(candidates_prelim) >= 1:
                pairs.append(
                    ExamPair(
                        board=board, institution=institution, role=role, year=year,
                        test_type=exam_doc.test_type, exam_doc=exam_doc,
                        answer_key_doc=candidates_prelim[0], status="waiting_final_key",
                        reason="only a preliminary answer key is published so far",
                    )
                )
                continue

            pairs.append(
                ExamPair(
                    board=board, institution=institution, role=role, year=year,
                    test_type=exam_doc.test_type, exam_doc=exam_doc, answer_key_doc=None,
                    status="needs_attention", reason="no answer key (preliminary or final) found for this exam",
                )
            )

    return pairs
