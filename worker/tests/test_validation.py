from tests.helpers import make_parsed_question

from lib.validation import validate_before_publish, validate_question_structure


def test_valid_question_a_to_d():
    q = make_parsed_question(letters="ABCD", correct="C").to_dict()
    assert validate_question_structure(q) == []


def test_valid_question_a_to_e():
    q = make_parsed_question(letters="ABCDE", correct="E").to_dict()
    assert validate_question_structure(q) == []


def test_too_few_alternatives_is_invalid():
    q = make_parsed_question(letters="AB", correct="A").to_dict()
    q["alternatives"] = q["alternatives"][:1]  # force down to 1, below the minimum of 2
    errors = validate_question_structure(q)
    assert any("alternativas" in e for e in errors)


def test_correct_letter_missing_from_alternatives():
    q = make_parsed_question(letters="ABCD", correct="C").to_dict()
    q["correctLetter"] = "Z"
    for alt in q["alternatives"]:
        alt["isCorrect"] = False
    errors = validate_question_structure(q)
    assert any("correctLetter" in e for e in errors)


def test_two_alternatives_marked_correct():
    q = make_parsed_question(letters="ABCD", correct="B").to_dict()
    q["alternatives"][2]["isCorrect"] = True  # mark a second one, on top of B
    errors = validate_question_structure(q)
    assert any("isCorrect=true" in e for e in errors)


def test_missing_explanation():
    q = make_parsed_question(letters="ABCD", correct="B", explanation="").to_dict()
    errors = validate_question_structure(q)
    assert any("explanation" in e for e in errors)


def test_missing_statement():
    q = make_parsed_question(letters="ABCD", correct="B").to_dict()
    q["statement"] = "   "
    errors = validate_question_structure(q)
    assert any("statement" in e for e in errors)


def test_before_publish_accepts_matching_import_fields():
    q = make_parsed_question(letters="ABCD", correct="B").to_dict()
    q["importSubject"] = "Direito Penal"
    q["importYear"] = 2025
    assert validate_before_publish(q, "Direito Penal", 2025) == []


def test_before_publish_rejects_mismatched_subject():
    q = make_parsed_question(letters="ABCD", correct="B").to_dict()
    q["importSubject"] = "Direito Penal"
    q["importYear"] = 2025
    errors = validate_before_publish(q, "Direito Civil", 2025)
    assert any("importSubject" in e for e in errors)


def test_before_publish_rejects_question_with_warnings():
    q = make_parsed_question(letters="ABCD", correct="B", warnings=["algo pendente"]).to_dict()
    q["importSubject"] = "Direito Penal"
    q["importYear"] = 2025
    errors = validate_before_publish(q, "Direito Penal", 2025)
    assert any("warnings" in e for e in errors)
