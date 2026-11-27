import pytest
from corpus_builder import A, B, AnnotationBuilder, write_corpus

from bjj_analysis import (
    earned_transitions,
    load_corpus,
    next_position_distribution,
    next_position_transitions,
)


def test_earned_transitions_list_each_boundary_between_segments(tmp_path):
    write_corpus(
        tmp_path,
        AnnotationBuilder("m1")
        .segment("standing", 20)
        .segment("closed_guard", 40, holder=B, via="guard_pull", by=B)
        .segment("mount", 30, holder=A, via="pass", by=A),
    )

    table = earned_transitions(load_corpus(tmp_path))

    assert table[["from_position_id", "to_position_id", "transition_type", "initiator"]].to_dict("records") == [
        {"from_position_id": "standing", "to_position_id": "closed_guard", "transition_type": "guard_pull", "initiator": B},
        {"from_position_id": "closed_guard", "to_position_id": "mount", "transition_type": "pass", "initiator": A},
    ]


def test_a_reset_is_a_path_break_not_an_earned_transition(tmp_path):
    write_corpus(
        tmp_path,
        AnnotationBuilder("m1")
        .segment("standing", 20)
        .segment("closed_guard", 40, holder=B, via="guard_pull", by=B)
        .reset("standing")
        .segment("leg_attack", 10, holder=A, via="other", by=A),
    )

    table = earned_transitions(load_corpus(tmp_path))

    pairs = list(zip(table["from_position_id"], table["to_position_id"]))
    assert pairs == [("standing", "closed_guard"), ("standing", "leg_attack")]
    assert "reset" not in set(table["transition_type"])


def guard_corpus(tmp_path):
    """Five Matches out of guard. Earned Transitions (from → to, by type):

    standing     → closed_guard  ×4 (guard_pull)
    standing     → open_guard    ×1 (guard_pull)
    closed_guard → mount         ×3 (pass ×2, sweep ×1)
    closed_guard → scramble      ×1 (sweep)
    open_guard   → side_control  ×1 (pass)
    """
    def pulled_to(position_id):
        return AnnotationBuilder(f"m-{len(matches) + 1}").segment("standing", 20).segment(
            position_id, 40, holder=B, via="guard_pull", by=B
        )

    matches = []
    matches.append(pulled_to("closed_guard").segment("mount", 30, holder=A, via="pass", by=A))
    matches.append(pulled_to("closed_guard").segment("mount", 30, holder=A, via="pass", by=A))
    matches.append(pulled_to("closed_guard").segment("mount", 30, holder=B, via="sweep", by=B))
    matches.append(pulled_to("closed_guard").segment("scramble", 10, via="sweep", by=B))
    matches.append(pulled_to("open_guard").segment("side_control", 30, holder=A, via="pass", by=A))
    return write_corpus(tmp_path, *matches)


def distribution_rows(table):
    return {
        (row.position_id, row.next_position_id): row
        for row in table.itertuples()
    }


def test_next_position_distribution_reproduces_known_counts(tmp_path):
    table = next_position_distribution(load_corpus(guard_corpus(tmp_path)))
    rows = distribution_rows(table)

    assert rows[("closed_guard", "mount")].count == 3
    assert rows[("closed_guard", "scramble")].count == 1
    assert rows[("closed_guard", "mount")].position_total == 4
    assert rows[("closed_guard", "mount")].observed_share == pytest.approx(3 / 4)
    assert rows[("standing", "closed_guard")].count == 4
    assert rows[("standing", "open_guard")].count == 1
    assert rows[("open_guard", "side_control")].count == 1
    assert rows[("closed_guard", "mount")].family == "guard"
    assert rows[("closed_guard", "mount")].next_family == "mount"


def test_next_position_distribution_is_smoothed_towards_the_family(tmp_path):
    # Worked by hand with prior_strength α = 2, family_prior_strength β = 1 and
    # K = 27 Positions in the vocabulary. The guard Family's pooled counts are
    # mount 3, scramble 1, side_control 1 (5 in all), so its smoothed
    # distribution is f(q) = (m_q + β/K) / (5 + β):
    #   f(mount) = (3 + 1/27) / 6 = 41/81,   f(side_control) = (1 + 1/27) / 6 = 14/81.
    # Each Position's probability is (n_q + α f(q)) / (N + α).
    table = next_position_distribution(
        load_corpus(guard_corpus(tmp_path)), prior_strength=2, family_prior_strength=1
    )
    rows = distribution_rows(table)

    assert rows[("closed_guard", "mount")].probability == pytest.approx(325 / 486)
    assert rows[("open_guard", "side_control")].probability == pytest.approx(109 / 243)
    # open_guard was never seen going to mount, but borrows it from its Family.
    assert rows[("open_guard", "mount")].count == 0
    assert rows[("open_guard", "mount")].probability == pytest.approx(82 / 243)


def test_without_a_prior_the_probability_is_the_observed_share(tmp_path):
    table = next_position_distribution(load_corpus(guard_corpus(tmp_path)), prior_strength=0)

    observed = table[table["count"] > 0]
    assert list(observed["probability"]) == pytest.approx(list(observed["observed_share"]))


def test_resets_do_not_count_towards_the_next_position_distribution(tmp_path):
    write_corpus(
        tmp_path,
        AnnotationBuilder("m1")
        .segment("standing", 20)
        .segment("closed_guard", 40, holder=B, via="guard_pull", by=B)
        .reset("standing")
        .segment("closed_guard", 40, holder=B, via="guard_pull", by=B),
    )

    rows = distribution_rows(next_position_distribution(load_corpus(tmp_path)))

    assert ("closed_guard", "standing") not in rows
    assert rows[("standing", "closed_guard")].count == 2


def test_next_position_transitions_count_the_transition_types_into_each_next_position(tmp_path):
    table = next_position_transitions(load_corpus(guard_corpus(tmp_path)))

    from_closed_guard = table[table["position_id"] == "closed_guard"]
    assert from_closed_guard[["next_position_id", "transition_type", "count", "share"]].to_dict("records") == [
        {"next_position_id": "mount", "transition_type": "pass", "count": 2, "share": pytest.approx(2 / 3)},
        {"next_position_id": "mount", "transition_type": "sweep", "count": 1, "share": pytest.approx(1 / 3)},
        {"next_position_id": "scramble", "transition_type": "sweep", "count": 1, "share": pytest.approx(1)},
    ]
