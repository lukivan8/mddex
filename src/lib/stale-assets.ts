// A deploy replaces every hashed file under /assets/. A page opened before the
// deploy still references the old hashes, so its next lazy route import fails.
// The server answers those misses with a real 404, and the browser recovers by
// reloading once to pick up the current build.

const ASSET_PREFIX = "/assets/";
const RELOAD_KEY = "mddex.stale-assets-reload.v1";
const RELOAD_COOLDOWN_MS = 30_000;

// Static assets are served before the Worker runs, so any /assets/ request that
// reaches it names a file the current deploy does not have. Without this the
// request falls through to the HTML not-found page, which a module import
// cannot report clearly.
export function missingAssetResponse(request: Request): Response | undefined {
  if (!new URL(request.url).pathname.startsWith(ASSET_PREFIX)) return;
  return new Response("Not found", {
    status: 404,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

const CHUNK_ERROR_PATTERNS = [
  /Failed to fetch dynamically imported module/i,
  /error loading dynamically imported module/i,
  /Importing a module script failed/i,
  /Unable to preload CSS/i,
];

export function isStaleAssetError(error: unknown): boolean {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "";
  return CHUNK_ERROR_PATTERNS.some((pattern) => pattern.test(message));
}

// Reloads at most once per cooldown so a genuinely missing file cannot cause a
// reload loop. Returns whether a reload was started.
export function reloadForStaleAssets(
  storage:
    Pick<Storage, "getItem" | "setItem"> | undefined = safeSessionStorage(),
  reload: () => void = () => window.location.reload(),
  now = Date.now(),
): boolean {
  // Without storage the cooldown cannot be enforced, so do not risk a loop.
  if (!storage) return false;
  try {
    const last = Number(storage.getItem(RELOAD_KEY) ?? Number.NaN);
    if (now - last < RELOAD_COOLDOWN_MS) return false;
    storage.setItem(RELOAD_KEY, String(now));
  } catch {
    // Storage is blocked, so the cooldown cannot be enforced either.
    return false;
  }
  reload();
  return true;
}

let installed = false;
export function installStaleAssetRecovery(target: Window = window): void {
  if (installed) return;
  installed = true;
  target.addEventListener("vite:preloadError", (event) => {
    if (reloadForStaleAssets()) event.preventDefault();
  });
}

function safeSessionStorage(): Storage | undefined {
  try {
    return window.sessionStorage;
  } catch {
    return undefined;
  }
}
