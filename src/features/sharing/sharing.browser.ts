import { z } from "zod";
import { warmIdentity, invalidateIdentity } from "./identity.browser";
import { decodeBuildLink } from "../builds/build.link";

const idSchema = z.object({ id: z.string().regex(/^[A-Za-z0-9_-]{22}$/) });
const storedSchema = z
  .array(z.object({ id: idSchema.shape.id, token: z.string().max(8192) }))
  .max(25);
const cacheKey = "mddex.shared-links.v1";
const flights = new Map<string, Promise<string>>();
let cached: z.infer<typeof storedSchema> | undefined;
function cache() {
  if (!cached) {
    try {
      cached = storedSchema.parse(
        JSON.parse(localStorage.getItem(cacheKey) ?? "[]"),
      );
    } catch {
      cached = [];
    }
  }
  return cached;
}
function remember(id: string, token: string) {
  cached = [
    ...cache().filter((entry) => entry.id !== id && entry.token !== token),
    { id, token },
  ].slice(-25);
  try {
    localStorage.setItem(cacheKey, JSON.stringify(cached));
  } catch {
    /* Memory cache works when storage is unavailable. */
  }
}
export function preparedLink(token: string) {
  const id = cache().find((entry) => entry.token === token)?.id;
  return id ? `${window.location.origin}/build?share=${id}` : undefined;
}
export function prepareLink(token: string): Promise<string> {
  const existing = preparedLink(token);
  if (existing) return Promise.resolve(existing);
  const current = flights.get(token);
  if (current) return current;
  const flight = (async () => {
    await warmIdentity();
    const response = await fetch("/api/build-links", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
      signal: AbortSignal.timeout(8000),
    });
    if (response.status === 401) invalidateIdentity();
    if (!response.ok) throw new Error("Link preparation unavailable");
    const { id } = idSchema.parse(await response.json());
    remember(id, token);
    return `${window.location.origin}/build?share=${id}`;
  })().finally(() => flights.delete(token));
  flights.set(token, flight);
  return flight;
}
const resolutionFlights = new Map<
  string,
  Promise<Awaited<ReturnType<typeof loadSharedBuild>>>
>();
export function resolveSharedBuild(url: URL, signal: AbortSignal) {
  const id = url.searchParams.get("share");
  if (!id || url.hash.startsWith("#build="))
    return loadSharedBuild(url, signal);
  let current = resolutionFlights.get(id);
  if (!current) {
    current = loadSharedBuild(url, AbortSignal.timeout(15_000)).finally(() =>
      resolutionFlights.delete(id),
    );
    resolutionFlights.set(id, current);
  }
  return current.then((build) => {
    signal.throwIfAborted();
    return structuredClone(build);
  });
}
async function loadSharedBuild(url: URL, signal: AbortSignal) {
  if (url.hash.startsWith("#build=")) return decodeBuildLink(url.hash.slice(7));
  const id = url.searchParams.get("share");
  if (!id || !/^[A-Za-z0-9_-]{22}$/.test(id))
    throw new Error("This build link is invalid.");
  const remembered = cache().find((entry) => entry.id === id);
  if (remembered) return decodeBuildLink(remembered.token);
  let response: Response | undefined;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      response = await fetch(`/api/build-links/${id}`, {
        signal: AbortSignal.any([signal, AbortSignal.timeout(8000)]),
        credentials: "omit",
      });
      if (response.ok || response.status < 500) break;
    } catch (error) {
      if (signal.aborted) throw error;
    }
    if (attempt < 2)
      await new Promise<void>((resolve, reject) => {
        const onAbort = () => {
          clearTimeout(timer);
          reject(new DOMException("Aborted", "AbortError"));
        };
        const timer = setTimeout(
          () => {
            signal.removeEventListener("abort", onAbort);
            resolve();
          },
          300 * (attempt + 1),
        );
        signal.addEventListener("abort", onAbort, { once: true });
      });
  }
  if (!response?.ok)
    throw new Error(
      response?.status === 404
        ? "This shared build could not be found."
        : "Could not load this shared build. Check your connection and try again.",
    );
  const { token } = z
    .object({ token: z.string().max(8192) })
    .parse(await response.json());
  const build = await decodeBuildLink(token);
  remember(id, token);
  return build;
}
