import { describe, expect, it } from "vitest";
import { descriptionVideos } from "./community.videos";
import type { Description } from "./community.schema";

const videos = (text: string) =>
  descriptionVideos([{ type: "paragraph", content: [[{ text }]] }]);

describe("YouTube links in creator notes", () => {
  it("recognizes shared links and deduplicates watch links for the same video", () => {
    expect(
      videos(
        "See https://youtu.be/ickJOH4k8b4?si=8D0ylReYAfuGU-wc and https://www.youtube.com/watch?v=ickJOH4k8b4.",
      ),
    ).toEqual([{ id: "ickJOH4k8b4", start: 0 }]);
  });

  it("supports mobile, Shorts, live, embeds and timestamp links", () => {
    expect(videos("https://m.youtube.com/watch?v=ickJOH4k8b4&t=1m30s")).toEqual(
      [{ id: "ickJOH4k8b4", start: 90 }],
    );
    for (const path of ["shorts", "live", "embed"])
      expect(videos(`www.youtube.com/${path}/ickJOH4k8b4`)).toEqual([
        { id: "ickJOH4k8b4", start: 0 },
      ]);
    expect(videos("https://youtu.be/ickJOH4k8b4#t=120")).toEqual([
      { id: "ickJOH4k8b4", start: 120 },
    ]);
  });

  it("finds links across formatting spans and preserves video order", () => {
    const description: Description = [
      {
        type: "paragraph",
        content: [
          [{ text: "https://youtu.be/" }, { text: "ickJOH4k8b4", bold: true }],
        ],
      },
      {
        type: "orderedList",
        content: [[{ text: "(https://youtu.be/M7lc1UVf-VE)." }]],
      },
    ];
    expect(descriptionVideos(description)).toEqual([
      { id: "ickJOH4k8b4", start: 0 },
      { id: "M7lc1UVf-VE", start: 0 },
    ]);
  });

  it("ignores channels, playlists, invalid IDs and lookalike domains", () => {
    expect(
      videos(
        "https://youtube.com/@creator https://youtube.com/playlist?list=123 https://youtu.be/invalid https://youtube.com.evil.test/watch?v=ickJOH4k8b4 https://example.com/watch?v=ickJOH4k8b4",
      ),
    ).toEqual([]);
  });
});
