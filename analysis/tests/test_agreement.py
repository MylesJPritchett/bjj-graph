import pytest
from corpus_builder import A, B, AnnotationBuilder, write_corpus

from bjj_analysis import agreement_report, earned_transitions, load_corpus


def guard_then_mount(annotation_id, guard="closed_guard", guard_holder=B):
    """100s: standing 20s, a guard 40s, mount 40s."""
    return (
        AnnotationBuilder(annotation_id)
        .segment("standing", 20)
        .segment(guard, 40, holder=guard_holder, via="guard_pull", by=B)
        .segment("mount", 40, holder=A, via="sweep", by=A)
        .result(winner=A, method="points")
    )


def report_for(tmp_path, *annotations):
    write_corpus(tmp_path, *annotations)
    return agreement_report(load_corpus(tmp_path, include_relabels=True))


def pair_row(report):
    assert len(report.pairs) == 1
    return report.pairs.iloc[0]


def test_an_annotation_compared_with_itself_agrees_completely(tmp_path):
    report = report_for(tmp_path, guard_then_mount("m1"), guard_then_mount("m1-relabel").relabel_of("m1"))

    row = pair_row(report)
    assert (row["original_id"], row["relabel_id"]) == ("m1", "m1-relabel")
    assert row["match_time"] == 100
    assert row["position_agreement"] == 1.0
    assert row["family_agreement"] == 1.0
    assert row["role_holder_agreement"] == 1.0
    assert row["transition_edit_distance"] == 0
    assert row["transition_alignment"] == 1.0
    assert report.positions["disagreement_time"].sum() == 0
    assert report.transitions["disagreements"].sum() == 0


def test_a_known_one_segment_disagreement_gives_the_expected_shares(tmp_path):
    # The re-label calls the 40s of closed guard open guard: same Family, same holder.
    report = report_for(
        tmp_path,
        guard_then_mount("m1"),
        guard_then_mount("m1-relabel", guard="open_guard").relabel_of("m1"),
    )

    row = pair_row(report)
    assert row["position_agreement"] == pytest.approx(0.6)
    assert row["family_agreement"] == pytest.approx(1.0)
    assert row["role_holder_agreement"] == pytest.approx(0.6)
    assert row["transition_alignment"] == 1.0
    assert report.confusions[["original_position_id", "relabel_position_id", "time"]].to_dict("records") == [
        {"original_position_id": "closed_guard", "relabel_position_id": "open_guard", "time": 40},
    ]


def test_the_same_position_with_a_different_role_holder_disagrees_only_on_the_role_holder(tmp_path):
    report = report_for(
        tmp_path,
        guard_then_mount("m1"),
        guard_then_mount("m1-relabel", guard_holder=A).relabel_of("m1"),
    )

    row = pair_row(report)
    assert row["position_agreement"] == 1.0
    assert row["role_holder_agreement"] == pytest.approx(0.6)
    closed_guard = report.positions.set_index("position_id").loc["closed_guard"]
    assert closed_guard["disagreement_time"] == 40
    assert closed_guard["role_holder_disagreement_time"] == 40


def test_the_disagreement_ranking_surfaces_the_most_confused_position(tmp_path):
    # Closed guard is mislabelled in both pairs (80s in all); open guard and
    # half guard each take 40s of that confusion in one pair; standing and
    # mount always agree.
    report = report_for(
        tmp_path,
        guard_then_mount("m1"),
        guard_then_mount("m1-relabel", guard="open_guard").relabel_of("m1"),
        guard_then_mount("m2"),
        guard_then_mount("m2-relabel", guard="half_guard").relabel_of("m2"),
    )

    ranking = report.positions
    assert ranking.iloc[0]["position_id"] == "closed_guard"
    assert ranking.iloc[0]["disagreement_time"] == 80
    assert ranking.iloc[0]["pairs"] == 2
    assert set(ranking.iloc[1:3]["position_id"]) == {"open_guard", "half_guard"}
    assert ranking.set_index("position_id").loc[["standing", "mount"], "disagreement_time"].tolist() == [0, 0]


def test_transition_sequences_are_aligned_by_edit_distance(tmp_path):
    # Original: guard_pull, sweep. Re-label: guard_pull, pass, then an extra back_take.
    relabel = (
        AnnotationBuilder("m1-relabel")
        .segment("standing", 20)
        .segment("closed_guard", 40, holder=B, via="guard_pull", by=B)
        .segment("mount", 30, holder=A, via="pass", by=A)
        .segment("back_control", 10, holder=A, via="back_take", by=A)
        .relabel_of("m1")
    )
    report = report_for(tmp_path, guard_then_mount("m1"), relabel)

    row = pair_row(report)
    assert (row["transitions_original"], row["transitions_relabel"]) == (2, 3)
    assert row["transition_edit_distance"] == 2
    assert row["transition_alignment"] == pytest.approx(1 / 3)
    transitions = report.transitions.set_index("transition_type")
    assert transitions.loc[["sweep", "pass", "back_take"], "disagreements"].tolist() == [1, 1, 1]
    assert transitions.loc["guard_pull", "disagreements"] == 0
    assert transitions.loc["guard_pull", "occurrences"] == 2


def test_a_relabel_without_its_original_is_listed_as_unpaired(tmp_path):
    report = report_for(tmp_path, guard_then_mount("m9-relabel").relabel_of("m9"))

    assert report.pairs.empty
    assert report.unpaired[["relabel_id", "relabel_of"]].to_dict("records") == [
        {"relabel_id": "m9-relabel", "relabel_of": "m9"},
    ]


def test_relabels_stay_out_of_the_main_statistics(tmp_path):
    write_corpus(
        tmp_path,
        guard_then_mount("m1"),
        guard_then_mount("m1-relabel", guard="open_guard").relabel_of("m1"),
    )

    main = load_corpus(tmp_path)

    assert set(earned_transitions(main)["annotation_id"]) == {"m1"}
    assert agreement_report(main).pairs.empty
