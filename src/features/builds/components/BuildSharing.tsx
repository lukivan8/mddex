import { useEffect, useState } from "react";
import { Button } from "@heroui/react";
import { Check, Share2 } from "lucide-react";
import type { Build } from "../build.types";
import { prepareLink, preparedLink } from "../../sharing/sharing.browser";
import { encodeBuildLink } from "../build.link";
import { trackEvent } from "../../analytics/analytics.browser";

export function ShareBuildButton({ build }: { build: Build }) {
  const [token, setToken] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [copying, setCopying] = useState(false);
  useEffect(() => {
    let active = true;
    setToken("");
    setError("");
    setCopied(false);
    void encodeBuildLink(build)
      .then((value) => {
        if (active) setToken(value);
      })
      .catch(() => {
        if (active) setError("Could not create a build link.");
      });
    return () => {
      active = false;
    };
  }, [build]);
  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 3000);
    return () => window.clearTimeout(timer);
  }, [copied]);
  return (
    <div className="build-share-control">
      <Button
        aria-label={copied ? "Link copied" : "Share build"}
        variant="secondary"
        size="sm"
        isDisabled={!token || copying}
        onPress={() => {
          setCopying(true);
          setError("");
          const fallback = `${window.location.origin}/build#build=${token}`;
          const confirmed = preparedLink(token);
          const link = confirmed
            ? Promise.resolve(confirmed)
            : navigator.onLine
              ? prepareLink(token).catch(() => fallback)
              : Promise.resolve(fallback);
          // Start clipboard access in the click gesture, including Safari.
          const copy =
            typeof ClipboardItem !== "undefined" && navigator.clipboard.write
              ? navigator.clipboard.write([
                  new ClipboardItem({
                    "text/plain": link.then(
                      (value) => new Blob([value], { type: "text/plain" }),
                    ),
                  }),
                ])
              : link.then((value) => navigator.clipboard.writeText(value));
          void copy
            .then(() => {
              setCopied(true);
              trackEvent("build_shared");
            })
            .catch(() =>
              setError(
                "Could not copy the link. Allow clipboard access and try again.",
              ),
            )
            .finally(() => setCopying(false));
        }}
      >
        <span role="status">
          {copied ? "Link copied" : copying ? "Sharing…" : "Share build"}
        </span>
        {copied ? <Check size={15} /> : <Share2 size={15} />}
      </Button>
      {error && (
        <span role="alert" className="share-error">
          {error}
        </span>
      )}
    </div>
  );
}
