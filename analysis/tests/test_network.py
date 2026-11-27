from corpus_builder import A, B, AnnotationBuilder, write_corpus

from bjj_analysis import load_corpus, transition_network


def test_the_network_has_a_node_per_position_and_edges_weighted_by_earned_transitions(tmp_path):
    write_corpus(
        tmp_path,
        AnnotationBuilder("m1")
        .segment("standing", 20)
        .segment("closed_guard", 40, holder=B, via="guard_pull", by=B)
        .segment("mount", 30, holder=A, via="pass", by=A),
        AnnotationBuilder("m2")
        .segment("standing", 20)
        .segment("closed_guard", 40, holder=B, via="guard_pull", by=B)
        .reset("standing"),
    )

    graph = transition_network(load_corpus(tmp_path))

    assert set(graph.nodes) == {"standing", "closed_guard", "mount"}
    assert graph.nodes["closed_guard"]["family"] == "guard"
    assert graph.nodes["closed_guard"]["segments"] == 2
    assert graph.nodes["closed_guard"]["time"] == 80
    assert {(u, v): d["count"] for u, v, d in graph.edges(data=True)} == {
        ("standing", "closed_guard"): 2,
        ("closed_guard", "mount"): 1,
    }
