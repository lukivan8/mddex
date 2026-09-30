import { z } from "zod";
import { communityProfile } from "./community.profile.server";
import { sendConfirmationEmail } from "./community.email";
import type { CommunityEnv } from "./community.server";

export const sessionSeconds = 7 * 24 * 60 * 60;
const cookieName = "mddex_community_identity";
export const reply = (data: unknown, status = 200, headers?: HeadersInit) =>
  Response.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex, nofollow",
      ...headers,
    },
  });
export async function tokenHash(value: string) {
  return Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)),
    ),
    (byte) => byte.toString(16).padStart(2, "0"),
  ).join("");
}
export async function identity(
  request: Request,
  db: D1DatabaseSession,
  now: number,
) {
  const token = request.headers
    .get("Cookie")
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(cookieName + "="))
    ?.slice(cookieName.length + 1);
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  return db
    .prepare(
      "SELECT email, expires_at FROM community_email_sessions WHERE token_hash = ? AND expires_at > ?",
    )
    .bind(await tokenHash(token), now)
    .first<{ email: string; expires_at: number }>();
}
const emailSchema = z
  .email()
  .max(254)
  .transform((email) => email.toLowerCase());
const requestSchema = z.object({
  email: emailSchema,
  requestId: z.uuid(),
  buildId: z.uuid().optional(),
});
const verifySchema = z.object({
  challengeId: z.uuid(),
  code: z.string().regex(/^\d{6}$/),
  sessionToken: z.string().regex(/^[a-f0-9]{64}$/),
});
type Challenge = {
  id: string;
  email: string;
  build_id: string | null;
  expires_at: number;
  attempts: number;
};
export async function emailAuth(
  request: Request,
  action: string,
  input: unknown,
  env: CommunityEnv,
  db: D1DatabaseSession,
  now: number,
) {
  const url = new URL(request.url);
  if (action === "request") {
    const parsed = requestSchema.safeParse(input);
    if (!parsed.success)
      return reply({ error: "Enter a valid email address" }, 400);
    const { email, requestId, buildId } = parsed.data;
    const previous = await db
      .prepare(
        "SELECT id, email, build_id, expires_at, attempts FROM community_email_challenges WHERE request_key = ?",
      )
      .bind(requestId)
      .first<Challenge>();
    if (previous) {
      if (previous.email !== email || previous.build_id !== (buildId ?? null))
        return reply(
          { error: "Confirmation request has changed. Request a new code." },
          409,
        );
      if (previous.expires_at <= now || previous.attempts >= 5)
        return reply({ error: "This code expired. Request a new code." }, 410);
      return reply({
        challengeId: previous.id,
        expiresAt: previous.expires_at,
      });
    }
    if (!env.RESEND_API_KEY || !env.COMMUNITY_EMAIL_FROM)
      return reply(
        {
          error:
            "Email confirmations are not configured yet. Please try again later.",
        },
        503,
      );
    // An atomic insert limits sends per email even across concurrent requests.
    let number: number;
    do {
      number = crypto.getRandomValues(new Uint32Array(1))[0];
    } while (number >= 4_294_000_000);
    const code = String(number % 1_000_000).padStart(6, "0");
    const id = crypto.randomUUID();
    const inserted = await db
      .prepare(
        `INSERT INTO community_email_challenges (id, request_key, email, build_id, code_hash, created_at, expires_at)
      SELECT ?, ?, ?, ?, ?, ?, ? WHERE (SELECT COUNT(*) FROM community_email_challenges WHERE email = ? AND created_at > ?) < 5
      AND NOT EXISTS (SELECT 1 FROM community_email_challenges WHERE email = ? AND created_at > ?)
      ON CONFLICT(request_key) DO NOTHING RETURNING id`,
      )
      .bind(
        id,
        requestId,
        email,
        buildId ?? null,
        await tokenHash(`${id}:${code}`),
        now,
        now + 600,
        email,
        now - 3600,
        email,
        now - 30,
      )
      .first();
    if (!inserted) {
      const concurrent = await db
        .prepare(
          "SELECT id, email, build_id, expires_at, attempts FROM community_email_challenges WHERE request_key = ?",
        )
        .bind(requestId)
        .first<Challenge>();
      if (
        concurrent &&
        concurrent.email === email &&
        concurrent.build_id === (buildId ?? null)
      )
        return reply({
          challengeId: concurrent.id,
          expiresAt: concurrent.expires_at,
        });
      return reply(
        { error: "Please wait before requesting another code." },
        429,
        { "Retry-After": "30" },
      );
    }
    const owner =
      !buildId ||
      !!(await db
        .prepare(
          "SELECT id FROM community_builds WHERE id = ? AND email = ? AND state = 'published'",
        )
        .bind(buildId, email)
        .first());
    if (owner) {
      try {
        await sendConfirmationEmail(
          env.RESEND_API_KEY,
          env.COMMUNITY_EMAIL_FROM,
          email,
          code,
          id,
          !!buildId,
        );
      } catch {
        await db
          .prepare("DELETE FROM community_email_challenges WHERE id = ?")
          .bind(id)
          .run();
        return reply(
          { error: "Could not send your confirmation. Please try again." },
          503,
        );
      }
    }
    await db.batch([
      db
        .prepare(
          "DELETE FROM community_email_challenges WHERE expires_at <= ? AND created_at <= ?",
        )
        .bind(now, now - 3600),
      db
        .prepare("DELETE FROM community_email_sessions WHERE expires_at <= ?")
        .bind(now),
    ]);
    return reply({ challengeId: id, expiresAt: now + 600 });
  }
  if (action === "verify") {
    const parsed = verifySchema.safeParse(input);
    if (!parsed.success)
      return reply({ error: "Enter the six-digit code from your email." }, 400);
    const { challengeId, code, sessionToken } = parsed.data;
    const codeHash = await tokenHash(`${challengeId}:${code}`);
    const sessionHash = await tokenHash(sessionToken);
    // Limit attempts and bind consumption to the client's random credential. Exact retries
    // recover the same session; a second credential cannot reuse a consumed code.
    await db.batch([
      db
        .prepare(
          "UPDATE community_email_challenges SET attempts = attempts + 1 WHERE id = ? AND expires_at > ? AND attempts < 5 AND session_hash IS NULL AND code_hash != ?",
        )
        .bind(challengeId, now, codeHash),
      db
        .prepare(
          `UPDATE community_email_challenges SET session_hash = ?, verified_at = COALESCE(verified_at, ?) WHERE id = ? AND code_hash = ? AND expires_at > ? AND attempts < 5
        AND (session_hash IS NULL OR session_hash = ?) AND (build_id IS NULL OR EXISTS (SELECT 1 FROM community_builds WHERE id = build_id AND state = 'published' AND community_builds.email = community_email_challenges.email))`,
        )
        .bind(sessionHash, now, challengeId, codeHash, now, sessionHash),
      db
        .prepare(
          `INSERT INTO community_email_sessions (token_hash, email, expires_at)
        SELECT session_hash, email, verified_at + ? FROM community_email_challenges WHERE id = ? AND code_hash = ? AND session_hash = ? AND expires_at > ? AND attempts < 5
        ON CONFLICT(token_hash) DO NOTHING`,
        )
        .bind(sessionSeconds, challengeId, codeHash, sessionHash, now),
    ]);
    const session = await db
      .prepare(
        `SELECT s.email, s.expires_at FROM community_email_sessions s JOIN community_email_challenges c ON c.session_hash = s.token_hash
      WHERE c.id = ? AND c.code_hash = ? AND s.token_hash = ? AND s.email = c.email AND c.expires_at > ? AND s.expires_at > ?`,
      )
      .bind(challengeId, codeHash, sessionHash, now, now)
      .first<{ email: string; expires_at: number }>();
    if (!session)
      return reply(
        {
          error:
            "Invalid or expired code. Check your email or request a new code.",
        },
        401,
      );
    return reply(
      {
        email: session.email,
        displayName:
          (await communityProfile(db, session.email))?.display_name ?? null,
        expiresAt: session.expires_at,
      },
      200,
      {
        "Set-Cookie": `${cookieName}=${sessionToken}; Path=/api/community-builds; HttpOnly; SameSite=Strict; Max-Age=${session.expires_at - now}${url.protocol === "https:" ? "; Secure" : ""}`,
      },
    );
  }
  return reply({ error: "Not found" }, 404);
}
