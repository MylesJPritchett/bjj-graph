// Which Segment is open in the Segment editor. UI-only state: it isn't part of
// the Annotation and isn't undone.

type Listener = (index: number | null) => void;

export class SegmentSelection {
  private listeners = new Set<Listener>();
  private index: number | null = null;

  get(): number | null {
    return this.index;
  }

  set(index: number | null) {
    this.index = index;
    for (const listener of this.listeners) listener(index);
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.index);
    return () => this.listeners.delete(listener);
  }
}
