import type { Source, VideoTime } from "./types";

const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;

function youtubeId(url: URL): string | undefined {
  const host = url.hostname.replace(/^(www|m)\./, "");
  let id: string | null | undefined;
  if (host === "youtu.be") id = url.pathname.slice(1);
  else if (host === "youtube.com" || host === "youtube-nocookie.com") {
    id = url.pathname === "/watch" ? url.searchParams.get("v") : url.pathname.match(/^\/(embed|live|shorts)\/([^/]+)/)?.[2];
  }
  return id && YOUTUBE_ID.test(id) ? id : undefined;
}

/** The source for a pasted video URL, or undefined if the tool can't play it. Only YouTube for now. */
export function sourceFromUrl(text: string): Source | undefined {
  let url: URL;
  try {
    url = new URL(text.trim());
  } catch {
    return undefined;
  }
  const id = youtubeId(url);
  if (!id) return undefined;
  return {
    platform: "youtube",
    video_id: id,
    url: `https://www.youtube.com/watch?v=${id}`,
    licence_status: "unknown",
  };
}

/** A kebab-case Annotation id from a video id and, when one video holds several Matches, the Match start. */
export function suggestAnnotationId(videoId: string, matchStart?: VideoTime): string {
  const slug = videoId
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return ["youtube", slug, matchStart === undefined ? undefined : Math.floor(matchStart)].filter((p) => p !== undefined).join("-");
}
