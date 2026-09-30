import { analyticsSchema } from "./analytics.schema";

export async function collectAnalytics(
  request: Request,
  dataset: AnalyticsEngineDataset,
) {
  const reply = (status: number) =>
    new Response(null, { status, headers: { "Cache-Control": "no-store" } });
  if (request.method !== "POST") return reply(405);
  if (
    request.headers.get("Origin") !== new URL(request.url).origin ||
    request.headers.get("Sec-Fetch-Site") === "cross-site"
  )
    return reply(403);
  if (
    request.headers.get("DNT") === "1" ||
    request.headers.get("Sec-GPC") === "1"
  )
    return reply(204);
  if (!request.headers.get("Content-Type")?.startsWith("application/json"))
    return reply(415);
  // Bound the actual body, including chunked requests without Content-Length.
  const reader = request.body?.getReader();
  if (!reader) return reply(400);
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 1024) {
        await reader.cancel();
        return reply(413);
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    const result = analyticsSchema.safeParse(
      JSON.parse(new TextDecoder().decode(bytes)),
    );
    if (!result.success) return reply(400);
    const { event, visitorId, sessionId, returning, path, label } = result.data;
    dataset.writeDataPoint({
      indexes: [visitorId],
      blobs: [
        event,
        visitorId,
        sessionId,
        path,
        returning ? "returning" : "new",
        "v2",
        label ?? "",
      ],
      doubles: [1],
    });
    return reply(204);
  } catch {
    return reply(400);
  } finally {
    reader.releaseLock();
  }
}
