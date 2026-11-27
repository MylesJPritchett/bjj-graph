// Types mirroring the shared data files in vocab/. vocab/README.md and the
// JSON Schemas there are the source of truth; keep these in step with them.

export type AthleteSlug = string;
export type VocabId = string;
/** Seconds from the start of the source video. */
export type VideoTime = number;

// ---- Vocabulary (vocab/vocabulary.json) ----

export interface Family {
  id: VocabId;
  name: string;
  definition: string;
}

export interface Position {
  id: VocabId;
  name: string;
  family: VocabId;
  symmetric: boolean;
  /** Asymmetric Positions only: the first Role comes first. */
  roles?: [string, string];
  hotkey: string;
  definition: string;
}

export interface TransitionType {
  id: VocabId;
  name: string;
  takes_initiator: boolean;
  hotkey: string;
  definition: string;
}

export interface Vocabulary {
  version: string;
  families: Family[];
  positions: Position[];
  transitions: TransitionType[];
}

// ---- Athlete registry (vocab/athletes.json) ----

export interface AthleteEntry {
  name: string;
  links?: Record<string, string>;
}

export interface AthleteRegistry {
  athletes: Record<AthleteSlug, AthleteEntry>;
}

// ---- Annotation (vocab/annotation.schema.json) ----

export interface Source {
  platform: "youtube" | "vimeo" | "other";
  video_id?: string;
  url?: string;
  licence_status: "official-channel" | "permission-granted" | "own-footage" | "unknown";
  licence_note?: string;
}

export interface MatchBounds {
  start_offset: VideoTime;
  end_offset: VideoTime;
}

export interface Metadata {
  event?: string;
  bracket?: string;
  round?: string;
  ruleset?: string;
  gi?: boolean;
  weight_class?: string;
  level?: string;
  camera?: { type?: "broadcast" | "fixed" | "handheld" | "other"; angle?: string };
  resolution?: string;
}

export interface Transition {
  transition_type: VocabId;
  initiator?: AthleteSlug;
}

export interface Segment {
  start: VideoTime;
  end: VideoTime;
  position_id: VocabId;
  first_role_holder?: AthleteSlug;
  entered_by?: Transition;
}

/** Every Score Event type, in the order the Score Event dialog lists them. */
export const SCORE_TYPES = ["points", "advantage", "penalty", "submission_finish", "submission_attempt"] as const;
export type ScoreType = (typeof SCORE_TYPES)[number];

export interface ScoreEvent {
  kind: "score";
  time: VideoTime;
  athlete: AthleteSlug;
  score_type: ScoreType;
  value?: number;
  note?: string;
}

/** Open set of typed kinds; only `score` exists in schema version 1. */
export type MatchEvent = ScoreEvent;

/** Every Method, in the order the Result form lists them. */
export const METHODS = ["submission", "points", "advantages", "referee_decision", "disqualification", "draw"] as const;
export type Method = (typeof METHODS)[number];

export interface Result {
  winner?: AthleteSlug;
  method: Method;
}

export interface Annotation {
  id: string;
  schema_version: 1;
  vocabulary_version: string;
  annotator: string;
  relabel_of?: string;
  source: Source;
  match?: MatchBounds;
  metadata: Metadata;
  athletes: AthleteSlug[];
  segments: Segment[];
  events: MatchEvent[];
  result?: Result;
}
