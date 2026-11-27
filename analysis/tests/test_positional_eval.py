import pytest
from scipy.stats import beta
from corpus_builder import A, B, AnnotationBuilder, write_corpus

from bjj_analysis import (
    eval_contributions,
    eval_sensitivity,
    load_corpus,
    positional_eval,
    positional_eval_by_perspective,
)


def contribution(table, annotation_id, position_id, athlete):
    rows = table[
        (table["annotation_id"] == annotation_id)
        & (table["position_id"] == position_id)
        & (table["athlete"] == athlete)
    ]
    assert len(rows) == 1
    return rows.iloc[0]


def test_five_brief_re_entries_in_one_match_contribute_at_most_one(tmp_path):
    match = AnnotationBuilder("m1").segment("standing", 10)
    for _ in range(5):
        match.segment("mount", 20, holder=A, via="advance", by=A).segment("scramble", 5, via="escape", by=B)
    write_corpus(tmp_path, match.result(winner=A))

    row = contribution(eval_contributions(load_corpus(tmp_path)), "m1", "mount", A)

    # Five 20s holds: 5 × 20/30 = 3.33 before the per-Match cap.
    assert row["segments"] == 5
    assert row["raw_weight"] == pytest.approx(100 / 30)
    assert row["weight"] == 1
    assert row["result"] == "win"


def test_a_long_neutral_sink_contributes_at_most_one_per_match(tmp_path):
    write_corpus(
        tmp_path,
        AnnotationBuilder("m1")
        .segment("standing", 10)
        .segment("fifty_fifty", 600, via="leg_entry", by=A)
        .result(method="draw"),
    )

    row = contribution(eval_contributions(load_corpus(tmp_path)), "m1", "fifty_fifty", A)

    # Ten minutes in 50/50 saturates at one Segment's full weight.
    assert row["raw_weight"] == 1
    assert row["weight"] == 1
    assert row["result"] == "draw"


def test_symmetric_positions_are_seen_from_the_initiator(tmp_path):
    write_corpus(
        tmp_path,
        AnnotationBuilder("m1")
        .segment("standing", 10)
        .segment("fifty_fifty", 30, via="leg_entry", by=B)
        .reset("standing")
        .result(winner=A),
    )

    table = eval_contributions(load_corpus(tmp_path))

    # B pulled A into 50/50 and lost. Standing at the start and after the
    # Reset has no Initiator, so it contributes nothing.
    assert table[["position_id", "athlete", "result"]].to_dict("records") == [
        {"position_id": "fifty_fifty", "athlete": B, "result": "loss"},
    ]


@pytest.mark.parametrize(
    ("cap", "expected"),
    [(15, 1.0), (30, 20 / 30), (60, 20 / 60)],
)
def test_the_cap_sets_how_long_a_hold_takes_to_count_fully(tmp_path, cap, expected):
    write_corpus(
        tmp_path,
        AnnotationBuilder("m1")
        .segment("standing", 10)
        .segment("closed_guard", 20, holder=B, via="guard_pull", by=B)
        .result(winner=B),
    )

    row = contribution(eval_contributions(load_corpus(tmp_path), cap=cap), "m1", "closed_guard", B)

    assert row["weight"] == pytest.approx(expected)


def test_matches_without_a_result_contribute_nothing(tmp_path):
    write_corpus(
        tmp_path,
        AnnotationBuilder("m1").segment("standing", 10).segment("mount", 30, holder=A, via="takedown", by=A),
    )

    assert eval_contributions(load_corpus(tmp_path)).empty


def eval_row(table, position_id):
    rows = table[table["position_id"] == position_id]
    assert len(rows) == 1
    return rows.iloc[0]


def test_a_brief_losing_mount_and_a_long_winning_mount_lean_win_for_the_mounter(tmp_path):
    write_corpus(
        tmp_path,
        AnnotationBuilder("m1")
        .segment("standing", 10)
        .segment("mount", 5, holder=A, via="takedown", by=A)
        .segment("scramble", 60, via="escape", by=B)
        .result(winner=B),
        AnnotationBuilder("m2")
        .segment("standing", 10)
        .segment("mount", 300, holder=A, via="takedown", by=A)
        .result(winner=A),
    )

    row = eval_row(positional_eval(load_corpus(tmp_path)), "mount")

    # Weighted Results: win 1, loss 5/30, draw 0.
    assert row["matches"] == 2
    assert row["segments"] == 2
    assert row["weight"] == pytest.approx(1 + 5 / 30)
    assert row["perspective"] == "first_role"
    assert row["role"] == "mounter"
    # Mount is alone in its Family, so the prior is uniform: Dirichlet(2, 7/6, 1).
    assert row["p_win"] == pytest.approx(12 / 25)
    assert row["p_win"] > row["p_loss"]
    assert row["p_win"] + row["p_loss"] + row["p_draw"] == pytest.approx(1)


def held(match_id, position_id, winner, *, holder=A, duration=60):
    """A Match where `holder` reaches `position_id` from standing and the Match ends there."""
    return (
        AnnotationBuilder(match_id)
        .segment("standing", 10)
        .segment(position_id, duration, holder=holder, via="takedown", by=holder)
        .result(winner=winner)
    )


def test_symmetric_evals_follow_the_initiator(tmp_path):
    # Whoever enters 50/50 wins three Matches out of three.
    write_corpus(
        tmp_path,
        *[
            AnnotationBuilder(f"m{i}")
            .segment("standing", 10)
            .segment("fifty_fifty", 60, via="leg_entry", by=initiator)
            .result(winner=initiator)
            for i, initiator in enumerate([A, B, A])
        ],
    )

    table = positional_eval_by_perspective(load_corpus(tmp_path))
    rows = table[table["position_id"] == "fifty_fifty"].set_index("perspective")

    assert rows.loc["initiator", "p_win"] > 0.5 > rows.loc["initiator", "p_loss"]
    assert rows.loc["opponent", "p_loss"] == pytest.approx(rows.loc["initiator", "p_win"])
    assert rows.loc["opponent", "p_win_high"] == pytest.approx(rows.loc["initiator", "p_loss_high"])
    assert eval_row(positional_eval(load_corpus(tmp_path)), "fifty_fifty")["perspective"] == "initiator"


def test_the_second_role_perspective_mirrors_the_first(tmp_path):
    write_corpus(tmp_path, held("m1", "mount", A), held("m2", "mount", A))

    rows = positional_eval_by_perspective(load_corpus(tmp_path)).set_index(["position_id", "perspective"])

    first, second = rows.loc[("mount", "first_role")], rows.loc[("mount", "second_role")]
    assert second["role"] == "mounted"
    assert second["p_win"] == pytest.approx(first["p_loss"])
    assert second["p_loss_low"] == pytest.approx(first["p_win_low"])
    assert second["p_draw"] == pytest.approx(first["p_draw"])
    assert second["matches"] == first["matches"] == 2


def test_a_rare_position_borrows_strength_from_its_family(tmp_path):
    # North-south and mount each have one losing Match. North-south's Family
    # (side control) also has ten winning side control Matches; mount's
    # Family has nothing else.
    write_corpus(
        tmp_path,
        *[held(f"sc{i}", "side_control", A) for i in range(10)],
        held("ns", "north_south", B),
        held("mt", "mount", B),
    )

    table = positional_eval(load_corpus(tmp_path))

    north_south, mount = eval_row(table, "north_south"), eval_row(table, "mount")
    assert north_south["weight"] == mount["weight"] == 1
    assert north_south["p_win"] > mount["p_win"]
    assert north_south["family_p_win"] > 0.5


def test_intervals_contain_the_estimate_and_narrow_as_data_grows(tmp_path):
    small = [held("s1", "mount", A), held("s2", "mount", B)]
    large = [held(f"l{i}", "mount", A if i % 2 else B) for i in range(20)]
    # Many wins and no draws at all: the draw estimate is tiny but still inside its interval.
    lopsided = [held(f"w{i}", "back_control", A) for i in range(40)]

    small_eval = eval_row(positional_eval(load_corpus(write_corpus(tmp_path / "small", *small))), "mount")
    large_corpus = load_corpus(write_corpus(tmp_path / "large", *large, *lopsided))
    large_eval = eval_row(positional_eval(large_corpus), "mount")

    for table in (positional_eval_by_perspective(large_corpus), positional_eval(load_corpus(tmp_path / "small"))):
        for result in ("win", "loss", "draw"):
            assert (table[f"p_{result}_low"] <= table[f"p_{result}"]).all()
            assert (table[f"p_{result}"] <= table[f"p_{result}_high"]).all()
    for result in ("win", "loss"):
        small_width = small_eval[f"p_{result}_high"] - small_eval[f"p_{result}_low"]
        large_width = large_eval[f"p_{result}_high"] - large_eval[f"p_{result}_low"]
        assert large_width < small_width


def test_wider_credible_mass_gives_wider_intervals(tmp_path):
    corpus = load_corpus(write_corpus(tmp_path, held("m1", "mount", A), held("m2", "mount", B)))

    narrow = eval_row(positional_eval(corpus, credible_mass=0.5), "mount")
    wide = eval_row(positional_eval(corpus, credible_mass=0.9), "mount")

    assert wide["p_win_low"] < narrow["p_win_low"] < narrow["p_win_high"] < wide["p_win_high"]


def test_the_sensitivity_table_reruns_the_eval_at_each_cap(tmp_path):
    # Closed guard held 20s in a lost Match and 60s in a won one: the longer
    # the cap, the less the brief loss counts.
    write_corpus(
        tmp_path,
        held("m1", "closed_guard", A, holder=B, duration=20),
        held("m2", "closed_guard", B, holder=B, duration=60),
    )

    table = eval_sensitivity(load_corpus(tmp_path))
    guard = table[table["position_id"] == "closed_guard"].set_index("cap")

    assert list(guard.index) == [15, 30, 60]
    assert guard["weight"].to_list() == pytest.approx([2, 1 + 20 / 30, 1 + 20 / 60])
    assert guard.loc[15, "p_win"] < guard.loc[30, "p_win"] < guard.loc[60, "p_win"]


def test_a_position_alone_in_its_family_gets_only_the_uniform_prior(tmp_path):
    # Mount is the only Position in its Family, so there is no other data to
    # pool towards: its own two wins must not be counted again as a prior.
    write_corpus(tmp_path, held("m1", "mount", A), held("m2", "mount", A))

    row = eval_row(positional_eval(load_corpus(tmp_path)), "mount")

    # Dirichlet((2, 0, 0) + (α + γ) / 3) with α = 2, γ = 1: (3, 1, 1).
    assert row["family_weight"] == 0
    assert row["family_p_win"] == pytest.approx(1 / 3)
    assert row["p_win"] == pytest.approx(3 / 5)
    assert row["p_win_low"] == pytest.approx(beta.ppf(0.05, 3, 2))
    assert row["p_win_high"] == pytest.approx(beta.ppf(0.95, 3, 2))
    assert row["p_draw"] == pytest.approx(1 / 5)


def test_the_family_prior_leaves_out_the_position_itself(tmp_path):
    # Side control loses its one Match; north-south (same Family) wins two.
    write_corpus(
        tmp_path,
        held("sc", "side_control", B),
        held("ns1", "north_south", A),
        held("ns2", "north_south", A),
    )

    row = eval_row(positional_eval(load_corpus(tmp_path)), "side_control")

    # The Family prior is north-south's data alone: ((2, 0, 0) + 1/3) / 3.
    assert row["family_weight"] == 2
    assert row["family_p_win"] == pytest.approx(7 / 9)
    assert row["family_p_loss"] == pytest.approx(1 / 9)
