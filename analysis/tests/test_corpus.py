from corpus_builder import A, B, AnnotationBuilder, write_corpus, write_raw

from bjj_analysis import load_corpus
from bjj_analysis.vocabulary import DEFAULT_VOCAB_DIR


def simple_match(annotation_id: str, **metadata) -> AnnotationBuilder:
    return (
        AnnotationBuilder(annotation_id, **metadata)
        .segment("standing", 20)
        .segment("closed_guard", 40, holder=B, via="guard_pull", by=B)
        .result(winner=A, method="points")
    )


def test_loads_every_annotation_in_the_corpus_directory(tmp_path):
    write_corpus(tmp_path, simple_match("m1"), simple_match("m2"))

    corpus = load_corpus(tmp_path)

    assert sorted(corpus.matches["annotation_id"]) == ["m1", "m2"]
    assert len(corpus.segments) == 4
    assert corpus.rejected.empty


def test_the_shared_sample_annotation_loads_cleanly():
    corpus = load_corpus(DEFAULT_VOCAB_DIR / "examples", pattern="sample-annotation.json")

    assert list(corpus.matches["annotation_id"]) == ["sample-0001"]
    assert len(corpus.segments) == 9
    assert corpus.rejected.empty


def test_an_annotation_that_breaks_the_schema_is_rejected_and_reported(tmp_path):
    broken = simple_match("broken").build()
    del broken["athletes"]
    write_corpus(tmp_path, simple_match("good"), broken)

    corpus = load_corpus(tmp_path)

    assert list(corpus.matches["annotation_id"]) == ["good"]
    assert list(corpus.rejected["file"]) == ["broken.json"]
    assert "athletes" in corpus.rejected["errors"].iloc[0]
    assert set(corpus.segments["annotation_id"]) == {"good"}


def test_a_file_that_is_not_json_is_rejected_and_reported(tmp_path):
    write_corpus(tmp_path, simple_match("good"))
    write_raw(tmp_path, "truncated.json", '{"id": "truncated", ')

    corpus = load_corpus(tmp_path)

    assert list(corpus.matches["annotation_id"]) == ["good"]
    assert list(corpus.rejected["file"]) == ["truncated.json"]


def test_an_annotation_using_a_position_missing_from_the_vocabulary_is_rejected(tmp_path):
    unknown = AnnotationBuilder("unknown").segment("standing", 20).segment("flying_squirrel", 30, by=A)
    write_corpus(tmp_path, simple_match("good"), unknown)

    corpus = load_corpus(tmp_path)

    assert list(corpus.matches["annotation_id"]) == ["good"]
    assert list(corpus.rejected["file"]) == ["unknown.json"]
    assert "flying_squirrel" in corpus.rejected["errors"].iloc[0]


def test_filters_keep_only_annotations_whose_metadata_match(tmp_path):
    write_corpus(
        tmp_path,
        simple_match("adcc-77", ruleset="adcc", weight_class="-77kg", event="ADCC 2022"),
        simple_match("adcc-88", ruleset="adcc", weight_class="-88kg", event="ADCC 2022"),
        simple_match("ibjjf-gi", ruleset="ibjjf", gi=True, weight_class="-77kg", event="Worlds"),
        simple_match("ibjjf-nogi", ruleset="ibjjf", gi=False, weight_class="-88kg", event="No-Gi Worlds"),
    )

    def ids(**filters):
        return sorted(load_corpus(tmp_path, **filters).matches["annotation_id"])

    assert ids(ruleset="adcc") == ["adcc-77", "adcc-88"]
    assert ids(gi=True) == ["ibjjf-gi"]
    assert ids(gi=False, weight_class="-88kg") == ["adcc-88", "ibjjf-nogi"]
    assert ids(event="ADCC 2022", weight_class="-77kg") == ["adcc-77"]
    assert ids(weight_class=["-77kg", "-88kg"], ruleset="ibjjf") == ["ibjjf-gi", "ibjjf-nogi"]


def test_filters_drop_the_segments_of_filtered_out_annotations(tmp_path):
    write_corpus(tmp_path, simple_match("keep", ruleset="adcc"), simple_match("drop", ruleset="ibjjf"))

    corpus = load_corpus(tmp_path, ruleset="adcc")

    assert set(corpus.segments["annotation_id"]) == {"keep"}
    assert [doc["id"] for doc in corpus.annotations] == ["keep"]


def test_an_annotation_missing_the_filtered_field_is_filtered_out(tmp_path):
    no_ruleset = simple_match("no-ruleset").build()
    del no_ruleset["metadata"]["ruleset"]
    write_corpus(tmp_path, simple_match("adcc"), no_ruleset)

    assert list(load_corpus(tmp_path, ruleset="adcc").matches["annotation_id"]) == ["adcc"]


def test_relabels_are_excluded_by_default(tmp_path):
    write_corpus(tmp_path, simple_match("original"), simple_match("original-relabel").relabel_of("original"))

    corpus = load_corpus(tmp_path)

    assert list(corpus.matches["annotation_id"]) == ["original"]
    assert set(corpus.segments["annotation_id"]) == {"original"}


def test_relabels_can_be_included_on_request(tmp_path):
    write_corpus(tmp_path, simple_match("original"), simple_match("original-relabel").relabel_of("original"))

    corpus = load_corpus(tmp_path, include_relabels=True)

    relabel_of = dict(zip(corpus.matches["annotation_id"], corpus.matches["relabel_of"]))
    assert relabel_of["original-relabel"] == "original"
    assert sorted(relabel_of) == ["original", "original-relabel"]
