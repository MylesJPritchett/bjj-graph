// "Add Athlete": a small form that saves a new Athlete to the registry through
// the dev server, for Athletes not yet listed (e.g. Athletes from a trials event).

import { addAthlete, suggestSlug, type NewAthlete } from "../../session/registry";
import type { AthleteSlug } from "../../session/types";
import { ApiError, api } from "../api";
import { h } from "../dom";
import type { Store } from "../store";

/** External profile sites offered by default; any other site can be typed in. */
const LINK_SITES = [
  { site: "bjjheroes", label: "BJJ Heroes" },
  { site: "digitsu", label: "Digitsu" },
];

export function mountAddAthleteForm(store: Store, onAdded: (slug: AthleteSlug) => void): HTMLElement {
  const name = h("input", { type: "text", placeholder: "e.g. Jo Trial" });
  const slug = h("input", { type: "text", class: "mono", placeholder: "jo-trial" });
  const siteLinks = LINK_SITES.map(({ site, label }) => ({
    site,
    input: h("input", { type: "url", placeholder: `${label} profile URL` }),
  }));
  const otherSite = h("input", { type: "text", class: "mono", placeholder: "other site, e.g. instagram" });
  const otherUrl = h("input", { type: "url", placeholder: "URL" });
  const message = h("span", { class: "notice error" });
  const submit = h("button", { type: "submit" }, "Save Athlete");

  // The slug follows the name until the annotator edits it by hand.
  let slugEdited = false;
  name.addEventListener("input", () => {
    if (!slugEdited) slug.value = suggestSlug(name.value);
  });
  slug.addEventListener("input", () => {
    slugEdited = slug.value !== "";
  });

  function entered(): NewAthlete {
    const links: Record<string, string> = {};
    for (const { site, input } of siteLinks) if (input.value.trim()) links[site] = input.value.trim();
    if (otherSite.value.trim() || otherUrl.value.trim()) links[otherSite.value.trim()] = otherUrl.value.trim();
    return { slug: slug.value.trim(), name: name.value, links };
  }

  function reset() {
    for (const input of [name, slug, otherSite, otherUrl, ...siteLinks.map((l) => l.input)]) input.value = "";
    slugEdited = false;
    message.textContent = "";
  }

  async function save(event: Event) {
    event.preventDefault();
    const athlete = entered();
    // Check locally first for an instant message; the server checks again before writing.
    const { rejection } = addAthlete(store.state.context.registry, athlete);
    if (rejection) {
      message.textContent = rejection;
      return;
    }
    submit.disabled = true;
    try {
      store.updateRegistry(await api.addAthlete(athlete));
      reset();
      form.hidden = true;
      onAdded(athlete.slug);
    } catch (error) {
      const details = error instanceof ApiError && error.details.length ? ` (${error.details.join("; ")})` : "";
      message.textContent = `Couldn't add the Athlete: ${(error as Error).message}${details}`;
    } finally {
      submit.disabled = false;
    }
  }

  const form = h(
    "form",
    { class: "add-athlete", hidden: true, onsubmit: save },
    h("div", { class: "row" }, h("label", {}, "Display name ", name), h("label", {}, "Slug ", slug)),
    h(
      "div",
      { class: "row" },
      ...siteLinks.map(({ input }) => input),
      h("span", {}, otherSite, " ", otherUrl),
    ),
    h(
      "div",
      { class: "row" },
      submit,
      h("button", { type: "button", onclick: () => ((form.hidden = true), reset()) }, "Cancel"),
      message,
    ),
  );
  return form;
}
