"""The Corpus as a network: nodes are Positions, edges are earned Transitions."""

from __future__ import annotations

from collections.abc import Mapping

import networkx as nx

from .corpus import Corpus
from .transitions import earned_transitions


def transition_network(corpus: Corpus) -> nx.DiGraph:
    """A directed graph of the Corpus.

    Nodes are the Positions seen in the Corpus, with `name`, `family`,
    `segments` (how many Segments) and `time` (total seconds held). Edges are
    earned Transitions between Positions, with `count`. Resets add no edges.
    """
    vocabulary = corpus.vocabulary
    graph = nx.DiGraph()
    by_position = corpus.segments.groupby("position_id")["duration"].agg(["size", "sum"])
    for position_id, row in by_position.iterrows():
        graph.add_node(
            position_id,
            name=vocabulary.positions[position_id]["name"],
            family=vocabulary.family_of(position_id),
            segments=int(row["size"]),
            time=float(row["sum"]),
        )
    counts = earned_transitions(corpus).groupby(["from_position_id", "to_position_id"]).size()
    for (source, target), count in counts.items():
        graph.add_edge(source, target, count=int(count))
    return graph


def plot_transition_network(
    graph: nx.DiGraph,
    *,
    ax=None,
    node_color: Mapping[str, float] | None = None,
    cmap: str = "RdBu",
    seed: int = 0,
):
    """Draw the network statically: edge width grows with Transition count.

    Nodes are coloured by Family, or by `node_color` (a value per Position,
    drawn with `cmap`) when given. Returns the matplotlib Axes.
    """
    import matplotlib.pyplot as plt

    if ax is None:
        _, ax = plt.subplots(figsize=(12, 9))
    ax.set_axis_off()
    if graph.number_of_nodes() == 0:
        ax.text(0.5, 0.5, "No Positions in this Corpus", ha="center", va="center")
        return ax

    layout = nx.spring_layout(graph, weight="count", seed=seed, k=1.5 / max(1, graph.number_of_nodes()) ** 0.5)
    counts = [d["count"] for _, _, d in graph.edges(data=True)]
    widest = max(counts, default=1)
    widths = [0.5 + 5.5 * c / widest for c in counts]
    sizes = [300 + 40 * graph.nodes[n]["segments"] for n in graph.nodes]

    if node_color is not None:
        colors = [node_color.get(n, float("nan")) for n in graph.nodes]
        nodes = nx.draw_networkx_nodes(
            graph, layout, ax=ax, node_color=colors, cmap=cmap, vmin=0, vmax=1, node_size=sizes
        )
        ax.figure.colorbar(nodes, ax=ax, shrink=0.6)
    else:
        families = sorted({graph.nodes[n]["family"] for n in graph.nodes})
        palette = plt.get_cmap("tab10")
        family_color = {f: palette(i % 10) for i, f in enumerate(families)}
        nx.draw_networkx_nodes(
            graph, layout, ax=ax, node_color=[family_color[graph.nodes[n]["family"]] for n in graph.nodes],
            node_size=sizes,
        )
        for family, color in family_color.items():
            ax.scatter([], [], color=color, label=family)
        ax.legend(title="Family", loc="lower left", fontsize="small")

    nx.draw_networkx_edges(
        graph, layout, ax=ax, width=widths, alpha=0.6, arrows=True, arrowsize=12,
        connectionstyle="arc3,rad=0.1", node_size=sizes,
    )
    nx.draw_networkx_labels(graph, layout, ax=ax, labels={n: graph.nodes[n]["name"] for n in graph.nodes}, font_size=8)
    return ax
