import { z } from "zod";
let identityFlight: Promise<string> | undefined;
export function invalidateIdentity() {
  identityFlight = undefined;
}
export function warmIdentity(): Promise<string> {
  if (!identityFlight) {
    identityFlight = (async () => {
      const response = await fetch("/api/identity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
        credentials: "same-origin",
        signal: AbortSignal.timeout(8000),
      });
      if (!response.ok) throw new Error("Identity unavailable");
      const { userId } = z
        .object({ userId: z.uuid() })
        .parse(await response.json());
      try {
        localStorage.setItem("mddex.identity.v1", JSON.stringify({ userId }));
      } catch {
        /* Identity authentication lives in the cookie. */
      }
      return userId;
    })().catch((error) => {
      identityFlight = undefined;
      throw error;
    });
  }
  return identityFlight;
}
