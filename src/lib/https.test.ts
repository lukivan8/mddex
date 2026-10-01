import { expect, it } from "vitest";
import { productionHttpsRedirect } from "./https";
it("redirects production HTTP to HTTPS preserving the path and query", () => {
  const response = productionHttpsRedirect(
    new Request("http://mddex.net/build?share=example", { method: "POST" }),
  );
  expect(response?.status).toBe(308);
  expect(response?.headers.get("Location")).toBe(
    "https://mddex.net/build?share=example",
  );
});
it.each([
  "https://mddex.net/build",
  "http://localhost:3100/build",
  "http://192.168.1.2:3000/build",
])("keeps HTTPS and local development unchanged: %s", (url) => {
  expect(productionHttpsRedirect(new Request(url))).toBeUndefined();
});
