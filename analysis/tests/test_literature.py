import pytest
from corpus_builder import A, B, AnnotationBuilder, write_corpus

from bjj_analysis import lamas_2024_comparison, load_corpus


def measure(table, name):
    rows = table[table["measure"] == name]
    assert len(rows) == 1
    return rows.iloc[0]


def corpus(tmp_path):
    return load_corpus(
        write_corpus(
            tmp_path,
            # Back control left twice: once into a choke, once by an escape.
            AnnotationBuilder("m1")
            .segment("standing", 10)
            .segment("back_control", 20, holder=A, via="back_take", by=A)
            .segment("rear_naked_choke", 10, holder=A, via="submission_entry", by=A)
            .segment("back_control", 20, holder=A, via="submission_escape", by=B)
            .segment("turtle", 20, holder=A, via="escape", by=B)
            .result(winner=A),
            # A triangle chained into an armbar: two submission Segments.
            AnnotationBuilder("m2")
            .segment("standing", 10)
            .segment("closed_guard", 20, holder=B, via="guard_pull", by=B)
            .segment("triangle", 10, holder=B, via="submission_entry", by=B)
            .segment("armbar", 10, holder=B, via="other", by=B)
            .result(winner=B, method="submission"),
        )
    )


def test_back_to_submission_share_is_the_share_of_back_exits_that_enter_a_submission(tmp_path):
    row = measure(lamas_2024_comparison(corpus(tmp_path)), "back_to_submission")

    assert row["lamas_2024"] == pytest.approx(0.45)
    assert row["corpus_value"] == pytest.approx(1 / 2)
    assert row["corpus_basis"] == "1 of 2 earned Transitions out of the back Family"


def test_submission_positions_per_athlete_per_match(tmp_path):
    row = measure(lamas_2024_comparison(corpus(tmp_path)), "submissions_per_athlete_per_match")

    # Three submission Segments over 2 Matches × 2 Athletes.
    assert row["lamas_2024"] == pytest.approx(1.03)
    assert row["corpus_value"] == pytest.approx(3 / 4)
