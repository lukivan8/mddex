import { useState } from "react";
import { MapPin } from "lucide-react";

export function LocationIcon({
  image,
  featured = false,
}: {
  image?: string;
  featured?: boolean;
}) {
  const [failed, setFailed] = useState<string>();
  return (
    <span
      className={`location-icon ${featured ? "location-icon-featured" : ""}`}
      aria-hidden="true"
    >
      {image && failed !== image ? (
        <img
          src={image}
          alt=""
          loading={featured ? "eager" : "lazy"}
          decoding="async"
          onError={() => setFailed(image)}
        />
      ) : (
        <MapPin size={featured ? 32 : 20} />
      )}
    </span>
  );
}
