import { descriptionText, type Description } from "./community.schema";

export function descriptionVideos(description: Description) {
  const videos = new Map<string, { id: string; start: number }>();
  for (const match of descriptionText(description).matchAll(
    /\b(?:https?:\/\/|www\.)(?:youtu\.be|(?:www\.|m\.|music\.)?youtube\.com|(?:www\.)?youtube-nocookie\.com)\/[^\s<>"']+/gi,
  )) {
    try {
      const link = match[0].replace(/[.,!?;:)\]}]+$/, "");
      const url = new URL(/^www\./i.test(link) ? `https://${link}` : link);
      const path = url.pathname.split("/").filter(Boolean);
      const id =
        url.hostname === "youtu.be"
          ? path[0]
          : path[0] === "watch"
            ? url.searchParams.get("v")
            : ["embed", "shorts", "live"].includes(path[0])
              ? path[1]
              : null;
      if (!id || !/^[\w-]{11}$/.test(id) || videos.has(id)) continue;
      const time =
        url.searchParams.get("t") ??
        url.searchParams.get("start") ??
        new URLSearchParams(url.hash.slice(1)).get("t") ??
        "";
      const duration = time.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/);
      const start = /^\d+$/.test(time)
        ? Number(time)
        : duration
          ? Number(duration[1] ?? 0) * 3600 +
            Number(duration[2] ?? 0) * 60 +
            Number(duration[3] ?? 0)
          : 0;
      videos.set(id, { id, start: Number.isSafeInteger(start) ? start : 0 });
    } catch {
      // Ignore incomplete or malformed links while the description is edited.
    }
  }
  return [...videos.values()];
}
