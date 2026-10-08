import type { Description } from "./community.schema";
import { descriptionVideos } from "./community.videos";

export function CommunityVideos({ description }: { description: Description }) {
  const videos = descriptionVideos(description);
  if (!videos.length) return null;
  return (
    <section className="community-videos" aria-label="Build videos">
      {videos.map(({ id, start }, index) => (
        <div className="community-video" key={id}>
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${id}${start ? `?start=${start}` : ""}`}
            title={`Build video ${index + 1}`}
            loading="lazy"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
          />
          <a
            href={`https://www.youtube.com/watch?v=${id}${start ? `&t=${start}s` : ""}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            Watch on YouTube ↗
          </a>
        </div>
      ))}
    </section>
  );
}
