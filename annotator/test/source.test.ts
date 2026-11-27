import { describe, expect, it } from "vitest";
import { sourceFromUrl, suggestAnnotationId } from "../src/session/source";

describe("a pasted video URL becomes a source", () => {
  it.each([
    "https://www.youtube.com/watch?v=MyUe7tIEWHc",
    "https://youtube.com/watch?v=MyUe7tIEWHc&t=95s",
    "https://youtu.be/MyUe7tIEWHc?t=10",
    "https://www.youtube.com/embed/MyUe7tIEWHc",
    "https://www.youtube.com/live/MyUe7tIEWHc",
    "https://m.youtube.com/watch?v=MyUe7tIEWHc",
  ])("%s", (url) => {
    expect(sourceFromUrl(url)).toEqual({
      platform: "youtube",
      video_id: "MyUe7tIEWHc",
      url: "https://www.youtube.com/watch?v=MyUe7tIEWHc",
      licence_status: "unknown",
    });
  });

  it("rejects a URL it can't play", () => {
    expect(sourceFromUrl("https://example.com/video.mp4")).toBeUndefined();
    expect(sourceFromUrl("not a url")).toBeUndefined();
  });

  it("suggests a slug id from the video id and Match start", () => {
    expect(suggestAnnotationId("MyUe7tIEWHc_x", 95.4)).toBe("youtube-myue7tiewhc-x-95");
    expect(suggestAnnotationId("MyUe7tIEWHc")).toBe("youtube-myue7tiewhc");
  });
});
