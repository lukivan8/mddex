import { describe, expect, it, vi } from "vitest";
import { collectAnalytics } from "./analytics.server";
const payload = {
  event: "page_view",
  visitorId: "b4fa8b18-964d-4337-8cc7-30d3a69cd292",
  sessionId: "5f2c9fd8-f646-4778-89d4-a7c80d507c0d",
  returning: false,
  path: "/collection",
};
function request(body: unknown = payload, headers = {}, method = "POST") {
  return new Request("https://mddex.net/api/analytics", {
    method,
    headers: {
      Origin: "https://mddex.net",
      "Content-Type": "application/json",
      ...headers,
    },
    ...(method === "POST" ? { body: JSON.stringify(body) } : {}),
  });
}
describe("analytics ingestion", () => {
  it("writes the documented schema using a visitor sampling index", async () => {
    const dataset = { writeDataPoint: vi.fn() };
    expect((await collectAnalytics(request(), dataset)).status).toBe(204);
    expect(dataset.writeDataPoint).toHaveBeenCalledWith({
      indexes: [payload.visitorId],
      blobs: [
        "page_view",
        payload.visitorId,
        payload.sessionId,
        "/collection",
        "new",
        "v2",
        "",
      ],
      doubles: [1],
    });
  });
  it("accepts canonical item pages and allowlisted filter labels", async () => {
    const dataset = { writeDataPoint: vi.fn() };
    const itemPage = {
      ...payload,
      path: "/catalog/melee-weapons/the-prospectors-pick",
      event: "catalog_category_selected",
      label: "melee_weapon",
    };
    expect((await collectAnalytics(request(itemPage), dataset)).status).toBe(
      204,
    );
    expect(dataset.writeDataPoint.mock.calls[0][0].blobs.slice(3)).toEqual([
      itemPage.path,
      "new",
      "v2",
      "melee_weapon",
    ]);
  });
  it.each([
    [request(payload, { Origin: "https://other.net" }), 403],
    [request(payload, { "Content-Type": "text/plain" }), 415],
    [request({ ...payload, event: "arbitrary" }), 400],
    [request({ ...payload, path: "/collection?q=private" }), 400],
    [request({ ...payload, path: "/catalog/mobs/private%20name" }), 400],
    [request({ ...payload, label: "private text" }), 400],
    [request({ ...payload, search: "private" }), 400],
    [request("x".repeat(1025)), 413],
    [request(payload, { DNT: "1" }), 204],
    [request(payload, { "Sec-GPC": "1" }), 204],
    [request(undefined, {}, "GET"), 405],
  ])(
    "rejects invalid or opted-out requests without writing",
    async (req, status) => {
      const dataset = { writeDataPoint: vi.fn() };
      expect((await collectAnalytics(req, dataset)).status).toBe(status);
      expect(dataset.writeDataPoint).not.toHaveBeenCalled();
    },
  );
});
