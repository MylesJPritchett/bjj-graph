import pandas as pd
import pytest
from corpus_builder import A, B, AnnotationBuilder, write_corpus

from bjj_analysis import load_corpus, retention, retention_exits


def retention_row(table, position_id):
    rows = table[table["position_id"] == position_id]
    assert len(rows) == 1
    return rows.iloc[0]


def test_median_hold_time_is_the_median_segment_duration(tmp_path):
    write_corpus(
        tmp_path,
        AnnotationBuilder("m1")
        .segment("standing", 10)
        .segment("mount", 20, holder=A, via="takedown", by=A)
        .segment("scramble", 5, via="escape", by=B)
        .segment("mount", 40, holder=A, via="advance", by=A)
        .result(winner=A),
        AnnotationBuilder("m2")
        .segment("standing", 10)
        .segment("mount", 60, holder=B, via="takedown", by=B)
        .result(winner=B),
    )

    row = retention_row(retention(load_corpus(tmp_path)), "mount")

    assert row["role"] == "mounter"
    assert row["segments"] == 3
    assert row["matches"] == 2
    assert row["median_hold"] == 40
    assert row["total_hold"] == 120


def mount_exit_corpus(directory):
    """Twenty-two Matches where A mounts B and then leaves mount three ways.

    - 10 Matches: A takes the back and wins. Back control is A's best Position.
    - 10 Matches: B escapes to closed guard with A as the guard player and B wins.
    - 2 Matches: B escapes to a Scramble; A wins one and B the other.

    A's mount wins 11 of 22, so its Eval sits near 0.5. From A's side, back
    control (won 10 of 10) is clearly better, being in closed guard (won 0
    of 10) clearly worse, and the Scramble (1 of 2) too uncertain to tell.
    """
    builders = []
    for i in range(10):
        builders.append(
            AnnotationBuilder(f"back{i}")
            .segment("standing", 10)
            .segment("mount", 60, holder=A, via="takedown", by=A)
            .segment("back_control", 60, holder=A, via="back_take", by=A)
            .result(winner=A)
        )
        builders.append(
            AnnotationBuilder(f"guard{i}")
            .segment("standing", 10)
            .segment("mount", 60, holder=A, via="takedown", by=A)
            .segment("closed_guard", 60, holder=A, via="escape", by=B)
            .result(winner=B)
        )
    for i, winner in enumerate([A, B]):
        builders.append(
            AnnotationBuilder(f"scramble{i}")
            .segment("standing", 10)
            .segment("mount", 60, holder=A, via="takedown", by=A)
            .segment("scramble", 60, via="escape", by=B)
            .result(winner=winner)
        )
    return write_corpus(directory, *builders)


def test_exits_are_judged_by_comparing_the_holders_evals(tmp_path):
    row = retention_row(retention(load_corpus(mount_exit_corpus(tmp_path))), "mount")

    assert row["exits"] == 22
    assert (row["better"], row["worse"], row["neutral"]) == (10, 10, 2)
    assert row["unjudged"] == 0
    assert row["p_better"] == pytest.approx(10 / 22)
    assert row["p_worse"] == pytest.approx(10 / 22)
    assert row["p_neutral"] == pytest.approx(2 / 22)


def test_the_match_end_is_not_an_exit(tmp_path):
    row = retention_row(retention(load_corpus(mount_exit_corpus(tmp_path))), "back_control")

    assert row["exits"] == 0
    assert row["match_ends"] == 10
    assert (row["better"], row["worse"], row["neutral"]) == (0, 0, 0)


def test_resets_are_counted_apart_and_never_judged(tmp_path):
    write_corpus(
        tmp_path,
        AnnotationBuilder("m1")
        .segment("standing", 10)
        .segment("mount", 30, holder=A, via="takedown", by=A)
        .reset("standing")
        .segment("mount", 30, holder=A, via="takedown", by=A)
        .result(winner=A),
    )

    row = retention_row(retention(load_corpus(tmp_path)), "mount")

    assert row["resets"] == 1
    assert row["match_ends"] == 1
    assert row["exits"] == 0


def test_a_symmetric_position_with_no_initiator_has_no_holder_so_its_exits_go_unjudged(tmp_path):
    write_corpus(
        tmp_path,
        AnnotationBuilder("m1")
        .segment("standing", 10)
        .segment("mount", 30, holder=A, via="takedown", by=A)
        .result(winner=A),
    )

    row = retention_row(retention(load_corpus(tmp_path)), "standing")

    # Standing at the Match start has no Initiator, so nobody holds it.
    assert row["exits"] == 1
    assert row["unjudged"] == 1
    assert (row["better"], row["worse"], row["neutral"]) == (0, 0, 0)
    assert pd.isna(row["p_better"])


def test_the_holder_is_followed_into_the_other_role_of_the_next_position(tmp_path):
    # A's mount is reversed: B sweeps and mounts A, and B wins every time.
    # From A's side mount (held by A) is good and being mounted is bad.
    builders = [
        AnnotationBuilder(f"r{i}")
        .segment("standing", 10)
        .segment("mount", 60, holder=A, via="takedown", by=A)
        .segment("mount", 60, holder=B, via="sweep", by=B)
        .result(winner=B)
        for i in range(10)
    ] + [
        AnnotationBuilder(f"w{i}").segment("standing", 10).segment("mount", 60, holder=A, via="takedown", by=A).result(winner=A)
        for i in range(10)
    ]
    exits = retention_exits(load_corpus(write_corpus(tmp_path, *builders)))

    reversal = exits[(exits["annotation_id"] == "r0") & (exits["exit"] == "earned") & (exits["position_id"] == "mount")]
    assert len(reversal) == 1
    reversal = reversal.iloc[0]
    assert reversal["holder"] == A
    assert reversal["perspective"] == "first_role"
    assert reversal["next_perspective"] == "second_role"
    assert reversal["judgement"] == "worse"
