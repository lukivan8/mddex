import { z } from "zod";
export class CommunityRequestError extends Error {
  constructor(
    message: string,
    public status: number,
    public fields?: { email?: string; displayName?: string },
  ) {
    super(message);
  }
}
export async function communityRequest(path = "", init?: RequestInit) {
  const response = await fetch(`/api/community-builds${path}`, {
    credentials: "same-origin",
    ...init,
    signal: init?.signal
      ? AbortSignal.any([init.signal, AbortSignal.timeout(15_000)])
      : AbortSignal.timeout(15_000),
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  const data = await response.json();
  if (!response.ok) {
    const errors = z
      .object({
        fields: z
          .object({
            email: z.string().optional(),
            displayName: z.string().optional(),
          })
          .optional(),
      })
      .safeParse(data);
    throw new CommunityRequestError(
      data &&
        typeof data === "object" &&
        "error" in data &&
        typeof data.error === "string"
        ? data.error
        : "Could not load community builds",
      response.status,
      errors.success ? errors.data.fields : undefined,
    );
  }
  return data as unknown;
}
