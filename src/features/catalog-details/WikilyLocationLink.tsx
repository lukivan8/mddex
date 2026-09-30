import { ExternalLink, MapPin } from "lucide-react";
import { wikilyLocationUrl } from "./wikily-location";

export function WikilyLocationLink({ name }: { name: string }) {
  const href = wikilyLocationUrl(name);
  return href ? (
    <a
      className="detail-location-link"
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`View ${name} on Wikily (opens in a new tab)`}
    >
      <MapPin size={14} aria-hidden="true" />
      View location on Wikily
      <ExternalLink size={12} aria-hidden="true" />
    </a>
  ) : null;
}
