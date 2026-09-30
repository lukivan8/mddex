import { decodeBuildLink } from "../builds/build.link";

const cookieName = (request: Request) =>
  new URL(request.url).protocol === "https:"
    ? "__Host-mddex_session"
    : "mddex_session";
const year = 365 * 24 * 60 * 60;
const reply = (data: unknown, status = 200, extra?: HeadersInit) =>
  Response.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex, nofollow",
      ...extra,
    },
  });
const random = (length: number) =>
  btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(length))))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
async function digest(value: string) {
  const result = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return [...new Uint8Array(result)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}
async function identity(request: Request, db: D1DatabaseSession) {
  const name = cookieName(request);
  const credential = request.headers
    .get("Cookie")
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(name + "="))
    ?.slice(name.length + 1);
  if (!credential || !/^[A-Za-z0-9_-]{43}$/.test(credential)) return null;
  const row = await db
    .prepare(
      "SELECT user_id FROM anonymous_sessions WHERE token_hash = ? AND expires_at > ?",
    )
    .bind(await digest(credential), Math.floor(Date.now() / 1000))
    .first<{ user_id: string }>();
  return row ? { ...row, credential } : null;
}
async function boundedToken(request: Request) {
  if (!request.body) throw new Error("Missing payload");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.length;
      if (length > 10_000) {
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
  const payload: unknown = JSON.parse(new TextDecoder().decode(bytes));
  if (
    !payload ||
    typeof payload !== "object" ||
    !("token" in payload) ||
    typeof payload.token !== "string"
  )
    throw new Error("Missing token");
  await decodeBuildLink(payload.token);
  return payload.token;
}

export async function sharingApi(
  request: Request,
  env: Pick<Env, "BUILD_DB" | "SHARE_RATE_LIMITER">,
): Promise<Response> {
  const url = new URL(request.url);
  const isIdentity = url.pathname === "/api/identity";
  if (
    !isIdentity &&
    url.pathname !== "/api/build-links" &&
    !/^\/api\/build-links\/[A-Za-z0-9_-]{22}$/.test(url.pathname)
  )
    return reply({ error: "Not found" }, 404);
  const db = env.BUILD_DB.withSession("first-primary");
  try {
    if (
      request.method === "GET" &&
      !isIdentity &&
      url.pathname !== "/api/build-links"
    ) {
      const row = await db
        .prepare("SELECT token FROM build_links WHERE id = ?")
        .bind(url.pathname.split("/").at(-1))
        .first<{ token: string }>();
      return row
        ? reply(row, 200, {
            "Cache-Control": "public, max-age=31536000, immutable",
          })
        : reply({ error: "Build link not found" }, 404);
    }
    if (request.method !== "POST")
      return reply({ error: "Method not allowed" }, 405, { Allow: "POST" });
    if (
      request.headers.get("Origin") !== url.origin ||
      !request.headers.get("Content-Type")?.startsWith("application/json")
    )
      return reply({ error: "Invalid origin or content type" }, 403);
    const session = await identity(request, db);
    if (!session) {
      if (!isIdentity)
        return reply({ error: "Anonymous session required" }, 401);
      // Only new identities use an IP bucket; existing users get their own bucket.
      const { success } = await env.SHARE_RATE_LIMITER.limit({
        key: `identity:${request.headers.get("CF-Connecting-IP") ?? "local"}`,
      });
      if (!success)
        return reply({ error: "Try again later" }, 429, {
          "Retry-After": "60",
        });
      const id = crypto.randomUUID();
      const credential = random(32);
      const now = Math.floor(Date.now() / 1000);
      await db.batch([
        db
          .prepare("INSERT INTO users (id, created_at) VALUES (?, ?)")
          .bind(id, now),
        db
          .prepare(
            "INSERT INTO anonymous_sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)",
          )
          .bind(await digest(credential), id, now + year),
      ]);
      const secure = url.protocol === "https:" ? "; Secure" : "";
      return reply({ userId: id }, 201, {
        "Set-Cookie": `${cookieName(request)}=${credential}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${year}${secure}`,
      });
    }
    if (isIdentity) {
      const now = Math.floor(Date.now() / 1000);
      await db
        .prepare(
          "UPDATE anonymous_sessions SET expires_at = ? WHERE token_hash = ?",
        )
        .bind(now + year, await digest(session.credential))
        .run();
      const secure = url.protocol === "https:" ? "; Secure" : "";
      return reply({ userId: session.user_id }, 200, {
        "Set-Cookie": `${cookieName(request)}=${session.credential}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${year}${secure}`,
      });
    }
    const { success } = await env.SHARE_RATE_LIMITER.limit({
      key: `share:${session.user_id}`,
    });
    if (!success)
      return reply({ error: "Try again later" }, 429, { "Retry-After": "60" });
    let token: string;
    try {
      token = await boundedToken(request);
    } catch {
      return reply({ error: "Invalid build payload" }, 400);
    }
    const hash = await digest(token);
    const existing = await db
      .prepare(
        "SELECT id FROM build_links WHERE creator_id = ? AND token_hash = ?",
      )
      .bind(session.user_id, hash)
      .first<{ id: string }>();
    if (existing) return reply(existing);
    const id = random(16);
    await db
      .prepare(
        "INSERT INTO build_links (id,token,token_hash,creator_id,created_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(creator_id,token_hash) DO NOTHING",
      )
      .bind(id, token, hash, session.user_id, Math.floor(Date.now() / 1000))
      .run();
    const saved = await db
      .prepare(
        "SELECT id FROM build_links WHERE creator_id = ? AND token_hash = ?",
      )
      .bind(session.user_id, hash)
      .first<{ id: string }>();
    return reply(saved, 201);
  } catch {
    console.error(
      JSON.stringify({ event: "sharing_api_failed", path: url.pathname }),
    );
    return reply({ error: "Sharing temporarily unavailable" }, 503);
  }
}
