import { describe, expect, it } from "vitest";
import { addAthlete, suggestSlug } from "../src/session/registry";
import { apply, newSession, violationsOf, withRegistry } from "../src/session/session";
import type { AthleteRegistry } from "../src/session/types";
import { sampleContext } from "./helpers";
import { run } from "./run";

const sample = (): AthleteRegistry => sampleContext().registry;

describe("adding an Athlete to the registry", () => {
  it("adds the Athlete under its slug, with a display name and optional external links", () => {
    const outcome = addAthlete(sample(), {
      slug: "jo-trial",
      name: "Jo Trial",
      links: { bjjheroes: "https://www.bjjheroes.com/?p=1" },
    });

    expect(outcome.rejection).toBeUndefined();
    expect(outcome.registry.athletes["jo-trial"]).toEqual({
      name: "Jo Trial",
      links: { bjjheroes: "https://www.bjjheroes.com/?p=1" },
    });
    expect(Object.keys(outcome.registry.athletes).sort()).toEqual(["alex-example", "jo-trial", "sam-example"]);
  });

  it("leaves links out when none are given and trims the display name", () => {
    const outcome = addAthlete(sample(), { slug: "jo-trial", name: "  Jo Trial ", links: {} });
    expect(outcome.registry.athletes["jo-trial"]).toEqual({ name: "Jo Trial" });
  });

  it("rejects a slug that is already in the registry, naming the Athlete who holds it", () => {
    const registry = sample();
    const outcome = addAthlete(registry, { slug: "sam-example", name: "Another Sam" });

    expect(outcome.rejection).toBe('The slug "sam-example" is already taken by Sam Example. Pick a different slug.');
    expect(outcome.registry).toBe(registry);
  });

  it("rejects a slug that isn't lowercase kebab-case", () => {
    for (const slug of ["Jo-Trial", "jo_trial", "jo--trial", "-jo", ""]) {
      expect(addAthlete(sample(), { slug, name: "Jo Trial" }).rejection).toMatch(/kebab-case/);
    }
  });

  it("rejects a blank display name", () => {
    expect(addAthlete(sample(), { slug: "jo-trial", name: "   " }).rejection).toMatch(/display name/);
  });

  it("rejects a link that isn't an http(s) URL or whose site key isn't snake_case", () => {
    expect(addAthlete(sample(), { slug: "jo-trial", name: "Jo", links: { digitsu: "not a url" } }).rejection).toMatch(
      /digitsu/,
    );
    expect(
      addAthlete(sample(), { slug: "jo-trial", name: "Jo", links: { "BJJ Heroes": "https://example.com" } }).rejection,
    ).toMatch(/BJJ Heroes/);
  });

  it("does not change the registry it was given", () => {
    const registry = sample();
    addAthlete(registry, { slug: "jo-trial", name: "Jo Trial" });
    expect(registry.athletes["jo-trial"]).toBeUndefined();
  });
});

describe("suggesting a slug from a display name", () => {
  it("lowercases, strips accents and joins words with hyphens", () => {
    expect(suggestSlug("Gordon Ryan")).toBe("gordon-ryan");
    expect(suggestSlug("  João  Gabriel Rocha ")).toBe("joao-gabriel-rocha");
    expect(suggestSlug("Nicky Ryan Jr.")).toBe("nicky-ryan-jr");
  });
});

describe("an Athlete added mid-Match", () => {
  it("is immediately selectable for the current Match, keeping the work so far", () => {
    const source = { platform: "youtube", video_id: "EXAMPLEVID0", licence_status: "unknown" } as const;
    const session = run(newSession(sampleContext(), { id: "trials-match", annotator: "tester", source }), [
      { type: "set_athletes", athletes: ["alex-example"] },
      { type: "set_match_start", time: 10 },
    ]);
    expect(apply(session, { type: "set_athletes", athletes: ["alex-example", "jo-trial"] }).rejection).toMatch(/jo-trial/);

    const { registry } = addAthlete(session.context.registry, { slug: "jo-trial", name: "Jo Trial" });
    const picked = run(withRegistry(session, registry), [
      { type: "set_athletes", athletes: ["alex-example", "jo-trial"] },
    ]);

    expect(picked.annotation.athletes).toEqual(["alex-example", "jo-trial"]);
    expect(picked.bounds).toEqual({ start: 10 });
    expect(violationsOf(picked).some((v) => v.message.includes("jo-trial"))).toBe(false);
  });
});
