import { claimDisplayName, communityProfile } from "./community.profile.server";
import { z } from "zod";
import {
  communityBuildSchema,
  communityDraftSchema,
  communityPostSchema,
  descriptionText,
} from "./community.schema";

export type CommunityEnv = Pick<Env, "BUILD_DB" | "SHARE_RATE_LIMITER"> & {
  RESEND_API_KEY?: string;
  COMMUNITY_EMAIL_FROM?: string;
};
import { emailAuth, identity, reply, tokenHash } from "./community.auth.server";
export { tokenHash } from "./community.auth.server";
type Row = {
  id: string;
  name: string;
  build_json: string;
  tags_json: string;
  description_json: string;
  display_name: string;
  discord: string;
  created_at: number;
  updated_at: number;
};
const publicColumns =
  "id, name, build_json, tags_json, description_json, display_name, discord, created_at, updated_at";
function publicBuild(row: Row) {
  return communityBuildSchema.parse({
    id: row.id,
    name: row.name,
    build: JSON.parse(row.build_json),
    tags: JSON.parse(row.tags_json),
    description: JSON.parse(row.description_json),
    displayName: row.display_name,
    discord: row.discord,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}
async function payload(request: Request) {
  if (!request.body) throw new Error("Missing payload");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      length += value.length;
      if (length > 65_536) {
        await reader.cancel();
        throw new Error("Payload too large");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return JSON.parse(new TextDecoder().decode(bytes)) as unknown;
}
async function authorized(
  request: Request,
  db: D1DatabaseSession,
  id: string,
  now: number,
) {
  const session = await identity(request, db, now);
  return (
    !!session &&
    !!(await db
      .prepare("SELECT id FROM community_builds WHERE id = ? AND email = ?")
      .bind(id, session.email)
      .first())
  );
}
export async function communityApi(
  request: Request,
  env: CommunityEnv,
): Promise<Response> {
  const url = new URL(request.url);
  const parts = url.pathname
    .slice("/api/community-builds".length)
    .split("/")
    .filter(Boolean);
  const [id, action] = parts;
  const now = Math.floor(Date.now() / 1000);
  if (
    parts.length > 2 ||
    (id && id !== "tags" && id !== "auth" && !z.uuid().safeParse(id).success)
  )
    return reply({ error: "Not found" }, 404);
  const db = env.BUILD_DB.withSession("first-primary");
  try {
    if (request.method === "GET") {
      if (id === "auth") {
        if (action !== "session") return reply({ error: "Not found" }, 404);
        const session = await identity(request, db, now);
        return reply({
          email: session?.email ?? null,
          displayName: session
            ? ((await communityProfile(db, session.email))?.display_name ??
              null)
            : null,
          expiresAt: session?.expires_at ?? null,
        });
      }
      if (!id) {
        const q = (url.searchParams.get("q") ?? "").slice(0, 100);
        const tag = (url.searchParams.get("tag") ?? "").slice(0, 32);
        const offset = Math.min(
          10_000,
          Math.max(0, Number(url.searchParams.get("offset")) || 0),
        );
        const result = await db
          .prepare(
            `SELECT ${publicColumns} FROM community_builds WHERE state = 'published' AND (? = '' OR instr(lower(name || ' ' || display_name || ' ' || description_text || ' ' || tags_json), lower(?)) > 0) AND (? = '' OR EXISTS (SELECT 1 FROM json_each(tags_json) WHERE lower(value) = lower(?))) ORDER BY created_at DESC, id DESC LIMIT 25 OFFSET ?`,
          )
          .bind(q, q, tag, tag, Math.floor(offset))
          .all<Row>();
        return reply({
          builds: result.results.slice(0, 24).map(publicBuild),
          hasMore: result.results.length > 24,
        });
      }
      if (id === "tags" && !action) {
        const result = await db
          .prepare(
            "SELECT value AS tag, COUNT(*) AS uses FROM community_builds, json_each(tags_json) WHERE state = 'published' GROUP BY lower(value) ORDER BY uses DESC, lower(value) LIMIT 500",
          )
          .all<{ tag: string }>();
        return reply({ tags: result.results.map((row) => row.tag) });
      }
      if (action && action !== "edit")
        return reply({ error: "Not found" }, 404);
      if (action === "edit" && !(await authorized(request, db, id, now)))
        return reply(
          { error: "Confirm your email before editing this build." },
          401,
        );
      const row = await db
        .prepare(
          `SELECT ${publicColumns} FROM community_builds WHERE id = ? AND state = 'published'`,
        )
        .bind(id)
        .first<Row>();
      return row
        ? reply(publicBuild(row))
        : reply({ error: "Build not found" }, 404);
    }
    if (!["POST", "PUT"].includes(request.method))
      return reply({ error: "Method not allowed" }, 405);
    if (
      request.headers.get("Origin") !== url.origin ||
      !request.headers.get("Content-Type")?.startsWith("application/json")
    )
      return reply({ error: "Invalid origin or content type" }, 403);
    if (
      id === "tags" ||
      (request.method === "PUT" && (!id || action)) ||
      (request.method === "POST" &&
        id &&
        !(id === "auth"
          ? ["request", "verify"].includes(action)
          : action === "delete"))
    )
      return reply({ error: "Not found" }, 404);
    const { success } = await env.SHARE_RATE_LIMITER.limit({
      key: `community:${action ?? request.method}:${request.headers.get("CF-Connecting-IP") ?? "local"}`,
    });
    if (!success)
      return reply({ error: "Too many requests. Try again shortly." }, 429, {
        "Retry-After": "60",
      });
    let input: unknown;
    try {
      input = await payload(request);
    } catch {
      return reply({ error: "Invalid or oversized request" }, 400);
    }
    if (id === "auth") return emailAuth(request, action, input, env, db, now);
    if (action === "delete") {
      if (!(await authorized(request, db, id, now)))
        return reply(
          { error: "Confirm your email before deleting this build." },
          401,
        );
      // Repeated deletions retain the original timestamp and never remove the row.
      await db
        .prepare(
          "UPDATE community_builds SET state = 'deleted', deleted_at = COALESCE(deleted_at, ?), updated_at = CASE WHEN state = 'published' THEN ? ELSE updated_at END WHERE id = ?",
        )
        .bind(now, now, id)
        .run();
      return reply({ id, deleted: true });
    }
    if (request.method === "PUT" && !(await authorized(request, db, id, now)))
      return reply(
        { error: "Confirm your email before editing this build." },
        401,
      );
    const parsed = (
      request.method === "PUT" ? communityDraftSchema : communityPostSchema
    ).safeParse(input);
    if (!parsed.success)
      return reply(
        { error: parsed.error.issues[0]?.message ?? "Invalid build" },
        400,
      );
    const session = await identity(request, db, now);
    const postEmail =
      "email" in parsed.data ? parsed.data.email : session?.email;
    if (!session || session.email !== postEmail)
      return reply(
        { error: "Confirm your email before publishing this build." },
        401,
      );
    const profile = await claimDisplayName(
      db,
      session.email,
      parsed.data.displayName,
      now,
    );
    if ("error" in profile) return reply(profile, 409);
    const draft = { ...parsed.data, displayName: profile.displayName };
    const build = { ...draft.build, name: draft.name };
    const values = [
      draft.name,
      JSON.stringify(build),
      JSON.stringify(draft.tags),
      JSON.stringify(draft.description),
      descriptionText(draft.description),
      draft.displayName,
      draft.discord,
    ];
    if (request.method === "PUT") {
      const updated = await db
        .prepare(
          "UPDATE community_builds SET name = ?, build_json = ?, tags_json = ?, description_json = ?, description_text = ?, display_name = ?, discord = ?, updated_at = ? WHERE id = ? AND state = 'published' RETURNING id",
        )
        .bind(...values, now, id)
        .first();
      return updated ? reply({ id }) : reply({ error: "Build not found" }, 404);
    }
    const post = communityPostSchema.parse(input);
    if (!session || session.email !== post.email)
      return reply(
        { error: "Confirm your email before publishing this build." },
        401,
      );
    const publishKey = request.headers.get("Idempotency-Key");
    if (!z.uuid().safeParse(publishKey).success)
      return reply({ error: "Missing publishing request ID" }, 400);
    const hash = await tokenHash(JSON.stringify(post));
    const createdId = crypto.randomUUID();
    const inserted = await db
      .prepare(
        "INSERT INTO community_builds (name, build_json, tags_json, description_json, description_text, display_name, discord, email, created_at, updated_at, id, publish_key, publish_hash) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(email, publish_key) DO NOTHING RETURNING id",
      )
      .bind(...values, post.email, now, now, createdId, publishKey, hash)
      .first<{ id: string }>();
    const result =
      inserted ??
      (await db
        .prepare(
          "SELECT id, publish_hash, state FROM community_builds WHERE email = ? AND publish_key = ?",
        )
        .bind(post.email, publishKey)
        .first<{ id: string; publish_hash: string; state: string }>());
    if (result && "state" in result && result.state === "deleted")
      return reply(
        { error: "This build was deleted and cannot be republished." },
        409,
      );
    if (!result || ("publish_hash" in result && result.publish_hash !== hash))
      return reply(
        {
          error:
            "This publishing request was already used for different build details.",
        },
        409,
      );
    return reply({ id: result.id }, inserted ? 201 : 200);
  } catch {
    console.error(
      JSON.stringify({ event: "community_api_failed", path: url.pathname }),
    );
    return reply(
      {
        error:
          "Community builds are temporarily unavailable. Please try again.",
      },
      503,
    );
  }
}
