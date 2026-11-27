import pytest
from scipy.stats import beta
from corpus_builder import A, B, AnnotationBuilder, write_corpus

from bjj_analysis import load_corpus, payoff_rates


def payoff_row(table, position_id):
    rows = table[table["position_id"] == position_id]
    assert len(rows) == 1
    return rows.iloc[0]


def test_a_score_within_30s_of_entering_counts_and_one_after_does_not(tmp_path):
    write_corpus(
        tmp_path,
        # Mount entered at 10; A scores at 25, inside the 30s horizon.
        AnnotationBuilder("m1")
        .segment("standing", 10)
        .segment("mount", 40, holder=A, via="takedown", by=A)
        .score(25, A, "points", 4)
        .result(winner=A),
        # Mount entered at 10; B's advantage at 45 is 35s later.
        AnnotationBuilder("m2")
        .segment("standing", 10)
        .segment("mount", 40, holder=A, via="takedown", by=A)
        .score(45, B, "advantage")
        .result(winner=B, method="advantages"),
    )

    row = payoff_row(payoff_rates(load_corpus(tmp_path)), "mount")

    assert row["entries"] == 2
    assert row["entries_with_payoff"] == 1
    assert row["observed_share"] == pytest.approx(0.5)
    assert row["matches"] == 2


def test_the_window_closes_at_the_next_reset(tmp_path):
    write_corpus(
        tmp_path,
        AnnotationBuilder("m1")
        .segment("standing", 10)  # entered at 0: window [0, 20], closed by the Reset
        .segment("mount", 10, holder=A, via="takedown", by=A)  # entered at 10: window [10, 20]
        .reset("standing", 30)  # entered at 20: window [20, 50]
        .score(25, B, "penalty")
        .result(winner=A),
    )

    table = payoff_rates(load_corpus(tmp_path))

    assert payoff_row(table, "mount")["entries_with_payoff"] == 0
    standing = payoff_row(table, "standing")
    assert (standing["entries"], standing["entries_with_payoff"]) == (2, 1)


def test_a_submission_win_counts_as_a_finish_at_the_match_end(tmp_path):
    write_corpus(
        tmp_path,
        AnnotationBuilder("m1")
        .segment("standing", 10)
        .segment("back_control", 15, holder=A, via="takedown", by=A)
        .segment("rear_naked_choke", 10, holder=A, via="submission_entry", by=A)
        .result(winner=A, method="submission"),
    )

    table = payoff_rates(load_corpus(tmp_path))

    # The Match ends at 35: 25s after entering back control, 10s after the choke.
    assert payoff_row(table, "back_control")["entries_with_payoff"] == 1
    assert payoff_row(table, "rear_naked_choke")["entries_with_payoff"] == 1
    assert payoff_row(table, "standing")["entries_with_payoff"] == 0


@pytest.mark.parametrize(("horizon", "expected"), [(10, 0), (30, 1)])
def test_the_horizon_is_a_parameter(tmp_path, horizon, expected):
    write_corpus(
        tmp_path,
        AnnotationBuilder("m1")
        .segment("standing", 10)
        .segment("mount", 60, holder=A, via="takedown", by=A)
        .score(30, A, "points", 4)
        .result(winner=A),
    )

    row = payoff_row(payoff_rates(load_corpus(tmp_path), horizon=horizon), "mount")

    assert row["entries_with_payoff"] == expected


def test_each_match_weighs_one_however_often_the_position_is_entered(tmp_path):
    # m1 enters mount five times and scores after every entry; m2 enters once
    # and never scores. Raw entries say 5 of 6; by Match it is 1 of 2.
    busy = AnnotationBuilder("m1").segment("standing", 10)
    for i in range(5):
        start = 10 + i * 20
        busy.segment("mount", 10, holder=A, via="takedown", by=A).score(start + 5, A, "advantage")
        busy.segment("standing", 10, via="escape", by=B)
    write_corpus(
        tmp_path,
        busy.result(winner=A, method="advantages"),
        AnnotationBuilder("m2").segment("standing", 10).segment("mount", 60, holder=A, via="takedown", by=A).result(winner=A),
    )

    row = payoff_row(payoff_rates(load_corpus(tmp_path)), "mount")

    assert (row["entries"], row["entries_with_payoff"]) == (6, 5)
    assert row["weight"] == 2
    # Mount is alone in its Family, so f falls back to 1/2 and the posterior
    # is Beta(1 + 1, 1 + 1), with mean 1/2.
    assert row["family_p_payoff"] == pytest.approx(0.5)
    assert row["p_payoff"] == pytest.approx(0.5)


def test_intervals_contain_the_estimate_and_narrow_as_data_grows(tmp_path):
    def matches(prefix, count):
        return [
            AnnotationBuilder(f"{prefix}{i}")
            .segment("standing", 10)
            .segment("mount", 60, holder=A, via="takedown", by=A)
            .score(20, A, "points", 4)
            if i % 2
            else AnnotationBuilder(f"{prefix}{i}").segment("standing", 10).segment("mount", 60, holder=A, via="takedown", by=A)
            for i in range(count)
        ]

    small = payoff_rates(load_corpus(write_corpus(tmp_path / "small", *[m.result(winner=A) for m in matches("s", 2)])))
    large = payoff_rates(load_corpus(write_corpus(tmp_path / "large", *[m.result(winner=A) for m in matches("l", 20)])))

    for table in (small, large):
        assert (table["p_payoff_low"] <= table["p_payoff"]).all()
        assert (table["p_payoff"] <= table["p_payoff_high"]).all()
    width = {
        name: payoff_row(table, "mount")["p_payoff_high"] - payoff_row(table, "mount")["p_payoff_low"]
        for name, table in (("small", small), ("large", large))
    }
    assert width["large"] < width["small"]


def scored_entry(match_id, position_id, *, scored):
    match = AnnotationBuilder(match_id).segment("standing", 40).segment(position_id, 60, holder=A, via="takedown", by=A)
    if scored:
        match.score(50, A, "points", 4)
    return match.result(winner=A)


def test_a_position_alone_in_its_family_gets_only_the_uniform_prior(tmp_path):
    # Both mount entries are followed by a score. Mount is the only Position
    # in its Family, so its own data must not be counted again as a prior.
    write_corpus(tmp_path, scored_entry("m1", "mount", scored=True), scored_entry("m2", "mount", scored=True))

    row = payoff_row(payoff_rates(load_corpus(tmp_path)), "mount")

    # f = 1/2, so Beta(2 + 2 · 1/2, 0 + 2 · 1/2) = Beta(3, 1).
    assert row["family_p_payoff"] == pytest.approx(0.5)
    assert row["p_payoff"] == pytest.approx(3 / 4)
    assert row["p_payoff_low"] == pytest.approx(beta.ppf(0.05, 3, 1))
    assert row["p_payoff_high"] == pytest.approx(beta.ppf(0.95, 3, 1))


def test_the_family_prior_leaves_out_the_position_itself(tmp_path):
    write_corpus(
        tmp_path,
        scored_entry("sc", "side_control", scored=False),
        scored_entry("ns1", "north_south", scored=True),
        scored_entry("ns2", "north_south", scored=True),
    )

    row = payoff_row(payoff_rates(load_corpus(tmp_path)), "side_control")

    # North-south alone: f = (2 + 1/2) / (2 + 1).
    assert row["family_p_payoff"] == pytest.approx(5 / 6)
