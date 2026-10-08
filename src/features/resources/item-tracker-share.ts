import { parseTrackerSave } from "./item-tracker";
const MAX_BYTES = 500_000;
export async function trackerShareToken(
  collected: ReadonlySet<string>,
): Promise<string> {
  const json = JSON.stringify({ version: 2, collected: [...collected].sort() });
  const buffer = await new Response(
    new Blob([json]).stream().pipeThrough(new CompressionStream("gzip")),
  ).arrayBuffer();
  return btoa(String.fromCharCode(...new Uint8Array(buffer)))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
}
export async function readTrackerShare(token: string): Promise<Set<string>> {
  if (!token || token.length > 60000 || !/^[\w-]+$/.test(token))
    throw new Error("Invalid collection link");
  const binary = atob(token.replaceAll("-", "+").replaceAll("_", "/"));
  const stream = new Blob([
    Uint8Array.from(binary, (character) => character.charCodeAt(0)),
  ])
    .stream()
    .pipeThrough(new DecompressionStream("gzip"));
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let text = "";
  let bytes = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > MAX_BYTES) throw new Error("Collection link is too large");
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
    return parseTrackerSave(text);
  } finally {
    await reader.cancel().catch(() => {});
  }
}
