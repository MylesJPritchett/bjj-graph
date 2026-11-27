import { copyFileSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it } from "vitest";
import { StoreError } from "../server/annotation-store";
import { addAthleteToRegistry } from "../server/registry-store";
import { registrySchemaErrors } from "../server/schema";

const sampleRegistry = fileURLToPath(new URL("../../vocab/examples/sample-athletes.json", import.meta.url));
let file: string;

beforeEach(() => {
  file = join(mkdtempSync(join(tmpdir(), "registry-")), "athletes.json");
  copyFileSync(sampleRegistry, file);
});

const onDisk = () => JSON.parse(readFileSync(file, "utf8"));

describe("saving a new Athlete to the registry file", () => {
  it("writes the Athlete to the file, which stays valid against the registry format", async () => {
    const registry = await addAthleteToRegistry(file, {
      slug: "jo-trial",
      name: "Jo Trial",
      links: { digitsu: "https://digitsu.com/athletes/jo-trial" },
    });

    expect(onDisk()).toEqual(registry);
    expect(onDisk().athletes["jo-trial"]).toEqual({
      name: "Jo Trial",
      links: { digitsu: "https://digitsu.com/athletes/jo-trial" },
    });
    expect(registrySchemaErrors(onDisk())).toEqual([]);
  });

  it("keeps slugs in alphabetical order with two-space indentation, for small diffs", async () => {
    await addAthleteToRegistry(file, { slug: "bea-trial", name: "Bea Trial" });

    const text = readFileSync(file, "utf8");
    expect(Object.keys(onDisk().athletes)).toEqual(["alex-example", "bea-trial", "sam-example"]);
    expect(text).toBe(JSON.stringify(onDisk(), null, 2) + "\n");
  });

  it("refuses a duplicate slug with a 409 and leaves the file untouched", async () => {
    const before = readFileSync(file, "utf8");

    const error = await addAthleteToRegistry(file, { slug: "alex-example", name: "Alex Again" }).catch((e) => e);

    expect(error).toBeInstanceOf(StoreError);
    expect(error.status).toBe(409);
    expect(error.message).toMatch(/already taken by Alex Example/);
    expect(readFileSync(file, "utf8")).toBe(before);
  });

  it("refuses an invalid Athlete with a 400 and leaves the file untouched", async () => {
    const before = readFileSync(file, "utf8");

    const error = await addAthleteToRegistry(file, { slug: "Not A Slug", name: "Jo" }).catch((e) => e);

    expect(error.status).toBe(400);
    expect(readFileSync(file, "utf8")).toBe(before);
  });

  it("refuses a request body that isn't shaped like an Athlete", async () => {
    const error = await addAthleteToRegistry(file, { slug: "jo-trial" } as never).catch((e) => e);
    expect(error.status).toBe(400);
  });
});
