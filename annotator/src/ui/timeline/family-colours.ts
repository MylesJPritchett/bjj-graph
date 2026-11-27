/** One colour per Family on the timeline strip. Unknown Families fall back to grey. */
const FAMILY_COLOURS: Record<string, string> = {
  standing: "#8d99ae",
  guard: "#2a9d8f",
  half_guard: "#8ab17d",
  side_control: "#e9c46a",
  mount: "#f4a261",
  back: "#e76f51",
  turtle: "#b5838d",
  leg_entanglement: "#6d597a",
  scramble: "#c9c9c9",
  submission: "#d62828",
};

export const familyColour = (familyId: string | undefined) => (familyId && FAMILY_COLOURS[familyId]) || "#999999";
