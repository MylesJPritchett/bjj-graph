import { describe, expect, it } from "vitest";
import { schemaErrors } from "../server/schema";
import { toJson } from "../src/session/serialize";
import { apply, newSession } from "../src/session/session";
import { sampleContext } from "./helpers";
import { run } from "./run";

const source = { platform: "youtube", video_id: "EXAMPLEVID0", licence_status: "unknown" } as const;
const fresh = () => newSession(sampleContext(), { id: "test-match", annotator: "tester", source });

describe("Match metadata", () => {
  it("records every metadata field, and the result saves as schema-valid", () => {
    const metadata = {
      event: "ADCC 2022",
      bracket: "men -88kg",
      round: "quarter-final",
      ruleset: "adcc",
      gi: false,
      weight_class: "-88kg",
      level: "elite",
      camera: { type: "broadcast", angle: "side, elevated" },
      resolution: "1080p",
    } as const;

    const session = run(fresh(), [{ type: "set_metadata", metadata }]);

    expect(session.annotation.metadata).toEqual(metadata);
    expect(schemaErrors(JSON.parse(toJson(session.annotation)))).toEqual([]);
  });

  it("replaces the previous metadata, dropping blank fields", () => {
    const session = run(fresh(), [
      { type: "set_metadata", metadata: { event: "ADCC 2022", round: "final" } },
      { type: "set_metadata", metadata: { event: "ADCC 2022", round: "  ", camera: { angle: "" } } },
    ]);

    expect(session.annotation.metadata).toEqual({ event: "ADCC 2022" });
  });

  it("rejects a ruleset that isn't a kebab-case id", () => {
    expect(apply(fresh(), { type: "set_metadata", metadata: { ruleset: "ADCC rules" } }).rejection).toBeDefined();
  });
});

describe("licence / permission status", () => {
  it("records the status and a note on the source", () => {
    const session = run(fresh(), [
      { type: "set_licence", licence_status: "official-channel", licence_note: "ADCC's own channel" },
    ]);

    expect(session.annotation.source).toEqual({
      ...source,
      licence_status: "official-channel",
      licence_note: "ADCC's own channel",
    });
  });

  it("a blank note removes the old one", () => {
    const session = run(fresh(), [
      { type: "set_licence", licence_status: "permission-granted", licence_note: "email of 1 May" },
      { type: "set_licence", licence_status: "permission-granted", licence_note: "" },
    ]);

    expect(session.annotation.source).toEqual({ ...source, licence_status: "permission-granted" });
  });
});
