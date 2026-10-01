import { afterEach, expect, it, vi } from "vitest";
import { randomId } from "./random-id";
afterEach(() => vi.unstubAllGlobals());
it("uses native UUID generation when available", () => {
  const native = vi.fn(() => "12345678-1234-4234-8234-123456789abc");
  vi.stubGlobal("crypto", { randomUUID: native });
  expect(randomId()).toBe("12345678-1234-4234-8234-123456789abc");
  expect(native).toHaveBeenCalledOnce();
});
it("falls back to secure bytes with UUID v4 version and variant bits", () => {
  const getRandomValues = vi.fn((bytes: Uint8Array) => bytes.fill(255));
  vi.stubGlobal("crypto", { getRandomValues });
  expect(randomId()).toBe("ffffffff-ffff-4fff-bfff-ffffffffffff");
  expect(getRandomValues).toHaveBeenCalledOnce();
});
it("does not substitute insecure random IDs when Web Crypto is unavailable", () => {
  vi.stubGlobal("crypto", undefined);
  expect(() => randomId()).toThrow("Secure random generation is unavailable");
});
