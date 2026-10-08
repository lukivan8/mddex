import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { communityApi, tokenHash, type CommunityEnv } from "./community.server";
import { addBuildVariant } from "../builds/build.variants";
import { emptyBuild } from "../builds/build.service";

const origin = "https://mddex.net";
let database: DatabaseSync;
let env: CommunityEnv;
let savedCookie: string | undefined;
const mail =
  vi.fn<(message: { text: string; html: string }) => Promise<{ id: string }>>();
function request(
  path = "",
  method = "GET",
  body?: unknown,
  cookie?: string,
  key: string = crypto.randomUUID(),
) {
  return new Request(`${origin}/api/community-builds${path}`, {
    method,
    headers: {
      Origin: origin,
      "Content-Type": "application/json",
      "Idempotency-Key": key,
      ...(cookie ? { Cookie: cookie } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}
function draft() {
  const build = emptyBuild("Frostbound ranger");
  build.slots.ranged = {
    itemSlug: "winter-touch",
    enchantments: ["multishot"],
    effects: ["freeze"],
    enchantmentTier: "III",
  };
  return {
    build,
    name: build.name,
    tags: ["Ranged", "Solo"],
    description: [
      {
        type: "paragraph",
        content: [[{ text: "Freeze the front line.", bold: true }]],
      },
    ],
    email: "creator@example.com",
    displayName: "Aurora",
    discord: "aurora.gg",
  };
}
async function challenge(
  email = "creator@example.com",
  buildId?: string,
  requestId = crypto.randomUUID(),
) {
  const response = await communityApi(
    request("/auth/request", "POST", { email, buildId, requestId }),
    env,
  );
  expect(response.status).toBe(200);
  const data = (await response.json()) as { challengeId: string };
  const sent = mail.mock.calls.at(-1)?.[0] as { text: string } | undefined;
  return {
    id: data.challengeId,
    code: /code is (\d{6})/.exec(sent?.text ?? "")?.[1],
    requestId,
  };
}
async function verify(id: string, code: string, sessionToken = "a".repeat(64)) {
  return communityApi(
    request("/auth/verify", "POST", { challengeId: id, code, sessionToken }),
    env,
  );
}
async function confirmed(
  email = "creator@example.com",
  token = "a".repeat(64),
) {
  const c = await challenge(email);
  const response = await verify(c.id, c.code!, token);
  expect(response.status).toBe(200);
  return response.headers.get("Set-Cookie")!.split(";")[0];
}
async function post(email = "creator@example.com", cookie?: string) {
  if (!cookie) {
    savedCookie ??= await confirmed();
    cookie = savedCookie;
  }
  const response = await communityApi(
    request(
      "",
      "POST",
      {
        ...draft(),
        email,
        displayName:
          email === "creator@example.com" ? "Aurora" : "Other creator",
      },
      cookie,
    ),
    env,
  );
  expect(response.status).toBe(201);
  return ((await response.json()) as { id: string }).id;
}
beforeEach(() => {
  database = new DatabaseSync(":memory:");
  savedCookie = undefined;
  database.exec(
    readFileSync(
      new URL("../../../migrations/0002_community_builds.sql", import.meta.url),
      "utf8",
    ),
  );
  database.exec(
    readFileSync(
      new URL(
        "../../../migrations/0003_community_identity.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  database.exec(
    readFileSync(
      new URL(
        "../../../migrations/0004_community_deleted_state.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  database.exec(
    readFileSync(
      new URL(
        "../../../migrations/0005_community_profiles.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  const session = {
    prepare(sql: string) {
      const statement = database.prepare(sql);
      let args: (string | number | null)[] = [];
      const adapter = {
        bind(...values: (string | number | null)[]) {
          args = values;
          return adapter;
        },
        async first() {
          return statement.get(...args) ?? null;
        },
        async all() {
          return { results: statement.all(...args), success: true };
        },
        async run() {
          const result = statement.run(...args);
          return {
            success: true,
            results: [],
            meta: { changes: Number(result.changes) },
          };
        },
      };
      return adapter;
    },
    async batch(statements: { run(): Promise<unknown> }[]) {
      database.exec("BEGIN");
      try {
        const result = [];
        for (const statement of statements) result.push(await statement.run());
        database.exec("COMMIT");
        return result;
      } catch (cause) {
        database.exec("ROLLBACK");
        throw cause;
      }
    },
  };
  env = {
    BUILD_DB: {
      withSession: () => session,
    } as unknown as CommunityEnv["BUILD_DB"],
    SHARE_RATE_LIMITER: { limit: async () => ({ success: true }) },
    RESEND_API_KEY: "test-resend-key",
    COMMUNITY_EMAIL_FROM: "builds@example.com",
  };
  mail.mockReset();
  mail.mockResolvedValue({ id: "mail-id" });
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: string, init: RequestInit) => {
      const result = await mail(JSON.parse(init.body as string));
      return Response.json(result);
    }),
  );
});
afterEach(() => {
  database.close();
  vi.unstubAllGlobals();
});

describe("community publishing and email editing", () => {
  it("stores equipment and rich content, searches and filters, and never returns email", async () => {
    const id = await post();
    const response = await communityApi(request(`/${id}`), env);
    const data = await response.json();
    expect(data).toMatchObject({
      name: "Frostbound ranger",
      build: { slots: { ranged: { enchantmentTier: "III" } } },
    });
    expect(JSON.stringify(data)).not.toContain("creator@example.com");
    expect(
      (
        (await (
          await communityApi(request("?q=Aurora&tag=ranged"), env)
        ).json()) as { builds: unknown[] }
      ).builds,
    ).toHaveLength(1);
    expect(
      (
        (await (await communityApi(request("?tag=Melee"), env)).json()) as {
          builds: unknown[];
        }
      ).builds,
    ).toHaveLength(0);
    expect(await (await communityApi(request("/tags"), env)).json()).toEqual({
      tags: ["Ranged", "Solo"],
    });
  });
  it("requires confirmation before publishing, reuses one email identity for owned builds only", async () => {
    expect((await communityApi(request("", "POST", draft()), env)).status).toBe(
      401,
    );
    const cookie = await confirmed();
    const id = await post("creator@example.com", cookie);
    const second = await post("creator@example.com", cookie);
    expect((await communityApi(request(`/${id}/edit`), env)).status).toBe(401);
    for (const buildId of [id, second]) {
      expect(
        (
          await communityApi(
            request(`/${buildId}/edit`, "GET", undefined, cookie),
            env,
          )
        ).status,
      ).toBe(200);
      expect(
        (
          await communityApi(
            request(
              `/${buildId}`,
              "PUT",
              { ...draft(), email: "attacker@example.com" },
              cookie,
            ),
            env,
          )
        ).status,
      ).toBe(200);
    }
    expect(
      database
        .prepare("SELECT email FROM community_builds WHERE id = ?")
        .get(id)?.email,
    ).toBe("creator@example.com");
    expect(
      (
        await communityApi(
          request(
            "",
            "POST",
            { ...draft(), email: "other@example.com" },
            cookie,
          ),
          env,
        )
      ).status,
    ).toBe(401);
    const otherCookie = await confirmed("other@example.com", "b".repeat(64));
    const otherId = await post("other@example.com", otherCookie);
    expect(
      (
        await communityApi(
          request(`/${otherId}/edit`, "GET", undefined, cookie),
          env,
        )
      ).status,
    ).toBe(401);
    expect(
      (await communityApi(request(`/${otherId}`, "PUT", draft(), cookie), env))
        .status,
    ).toBe(401);
  });
  it("binds one unique display name to each verified email and returns field errors", async () => {
    const cookie = await confirmed();
    const id = await post("creator@example.com", cookie);
    const session = await communityApi(
      request("/auth/session", "GET", undefined, cookie),
      env,
    );
    expect(await session.json()).toMatchObject({
      email: "creator@example.com",
      displayName: "Aurora",
    });
    const mismatch = await communityApi(
      request("", "POST", { ...draft(), displayName: "Different" }, cookie),
      env,
    );
    expect(mismatch.status).toBe(409);
    expect(await mismatch.json()).toMatchObject({
      fields: {
        email: expect.any(String),
        displayName: "Use Aurora for this email.",
      },
    });
    expect(
      (
        await communityApi(
          request(
            `/${id}`,
            "PUT",
            { ...draft(), displayName: "Different" },
            cookie,
          ),
          env,
        )
      ).status,
    ).toBe(409);
    const otherCookie = await confirmed("other@example.com", "b".repeat(64));
    expect(
      (
        await communityApi(
          request(
            "",
            "POST",
            { ...draft(), email: "other@example.com", displayName: " aUrOrA " },
            otherCookie,
          ),
          env,
        )
      ).status,
    ).toBe(409);
    expect(
      database.prepare("SELECT COUNT(*) AS count FROM community_profiles").get()
        ?.count,
    ).toBe(1);
    const same = await communityApi(
      request("", "POST", { ...draft(), displayName: "aurora" }, cookie),
      env,
    );
    expect(same.status).toBe(201);
    const sameId = ((await same.json()) as { id: string }).id;
    expect(
      await (await communityApi(request(`/${sameId}`), env)).json(),
    ).toMatchObject({ displayName: "Aurora" });
    await communityApi(request(`/${id}/delete`, "POST", {}, cookie), env);
    expect(
      (
        await communityApi(
          request(
            "",
            "POST",
            { ...draft(), email: "other@example.com" },
            otherCookie,
          ),
          env,
        )
      ).status,
    ).toBe(409);
  });
  it("does not reserve a display name without a confirmed identity", async () => {
    expect((await communityApi(request("", "POST", draft()), env)).status).toBe(
      401,
    );
    expect(
      database.prepare("SELECT COUNT(*) AS count FROM community_profiles").get()
        ?.count,
    ).toBe(0);
  });
  it("makes publishing idempotent and refuses key reuse for different content", async () => {
    const cookie = await confirmed();
    const key = crypto.randomUUID();
    const data = draft();
    const first = await communityApi(
      request("", "POST", data, cookie, key),
      env,
    );
    const retry = await communityApi(
      request("", "POST", data, cookie, key),
      env,
    );
    expect(first.status).toBe(201);
    expect(retry.status).toBe(200);
    expect(await first.json()).toEqual(await retry.json());
    expect(
      database.prepare("SELECT COUNT(*) AS count FROM community_builds").get()
        ?.count,
    ).toBe(1);
    expect(
      (
        await communityApi(
          request("", "POST", { ...data, name: "Changed" }, cookie, key),
          env,
        )
      ).status,
    ).toBe(409);
  });
  it("sends once for repeated confirmation requests and recovers verification retries", async () => {
    const c = await challenge("CREATOR@example.com");
    const retried = await communityApi(
      request("/auth/request", "POST", {
        email: "creator@example.com",
        requestId: c.requestId,
      }),
      env,
    );
    expect(
      ((await retried.json()) as { challengeId: string }).challengeId,
    ).toBe(c.id);
    expect(mail).toHaveBeenCalledTimes(1);
    expect(
      database.prepare("SELECT code_hash FROM community_email_challenges").get()
        ?.code_hash,
    ).toBe(await tokenHash(`${c.id}:${c.code}`));
    const response = await verify(c.id, c.code!);
    expect(response.status).toBe(200);
    const cookie = response.headers.get("Set-Cookie")!;
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("Secure");
    expect(cookie).toContain("SameSite=Strict");
    expect(cookie).toContain("Max-Age=604800");
    const retry = await verify(c.id, c.code!);
    expect(retry.status).toBe(200);
    expect(retry.headers.get("Set-Cookie")).toBe(cookie);
    expect((await verify(c.id, c.code!, "b".repeat(64))).status).toBe(401);
    expect(
      database
        .prepare("SELECT COUNT(*) AS count FROM community_email_sessions")
        .get()?.count,
    ).toBe(1);
    expect(
      (
        await communityApi(
          request("/auth/request", "POST", {
            email: "wrong@example.com",
            requestId: c.requestId,
          }),
          env,
        )
      ).status,
    ).toBe(409);
  });
  it("does not send an edit code to a nonowner or reveal matching ownership", async () => {
    const id = await post();
    mail.mockClear();
    const wrong = await communityApi(
      request("/auth/request", "POST", {
        email: "wrong@example.com",
        buildId: id,
        requestId: crypto.randomUUID(),
      }),
      env,
    );
    expect(wrong.status).toBe(200);
    expect(mail).not.toHaveBeenCalled();
    const data = (await wrong.json()) as { challengeId: string };
    expect((await verify(data.challengeId, "123456")).status).toBe(401);
    database
      .prepare(
        "UPDATE community_email_challenges SET created_at = created_at - 31",
      )
      .run();
    const correct = await challenge("creator@example.com", id);
    expect(correct.code).toMatch(/^\d{6}$/);
    expect(mail).toHaveBeenCalledTimes(1);
    expect(
      (await verify(correct.id, correct.code!, "b".repeat(64))).status,
    ).toBe(200);
  });
  it("limits wrong guesses and rejects expired codes and seven-day sessions", async () => {
    const c = await challenge();
    const wrong = c.code === "000000" ? "111111" : "000000";
    for (let i = 0; i < 5; i++)
      expect((await verify(c.id, wrong)).status).toBe(401);
    expect((await verify(c.id, c.code!)).status).toBe(401);
    database
      .prepare(
        "UPDATE community_email_challenges SET attempts = 0, expires_at = 1",
      )
      .run();
    expect((await verify(c.id, c.code!)).status).toBe(401);
    const cookie = await confirmed("other@example.com", "b".repeat(64));
    const id = await post("other@example.com", cookie);
    database
      .prepare("UPDATE community_email_sessions SET expires_at = 1")
      .run();
    expect(
      (
        await communityApi(
          request(`/${id}/edit`, "GET", undefined, cookie),
          env,
        )
      ).status,
    ).toBe(401);
    expect(
      (
        await communityApi(
          request(
            "",
            "POST",
            { ...draft(), email: "other@example.com" },
            cookie,
          ),
          env,
        )
      ).status,
    ).toBe(401);
    expect(
      await (
        await communityApi(
          request("/auth/session", "GET", undefined, cookie),
          env,
        )
      ).json(),
    ).toEqual({ email: null, displayName: null, expiresAt: null });
  });
  it("limits resends per email without invalidating the pending code", async () => {
    const c = await challenge();
    expect(
      (
        await communityApi(
          request("/auth/request", "POST", {
            email: "creator@example.com",
            requestId: crypto.randomUUID(),
          }),
          env,
        )
      ).status,
    ).toBe(429);
    expect((await verify(c.id, c.code!)).status).toBe(200);
    expect(mail).toHaveBeenCalledTimes(1);
  });
  it("rejects cross-origin changes, empty builds, oversized requests and arbitrary HTML", async () => {
    const foreign = new Request(`${origin}/api/community-builds`, {
      method: "POST",
      headers: {
        Origin: "https://evil.example",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(draft()),
    });
    expect((await communityApi(foreign, env)).status).toBe(403);
    expect(
      (
        await communityApi(
          request("", "POST", { ...draft(), build: emptyBuild() }),
          env,
        )
      ).status,
    ).toBe(400);
    expect(
      (
        await communityApi(
          request("", "POST", {
            ...draft(),
            description: [{ type: "html", content: "<script>bad()</script>" }],
          }),
          env,
        )
      ).status,
    ).toBe(400);
    expect(
      (
        await communityApi(
          request("", "POST", { ...draft(), extra: "x".repeat(70_000) }),
          env,
        )
      ).status,
    ).toBe(400);
  });
  it("soft-deletes only for the owner, hides every public surface and requires manual restoration", async () => {
    const id = await post();
    const original = database
      .prepare("SELECT * FROM community_builds WHERE id = ?")
      .get(id)!;
    expect(
      (await communityApi(request(`/${id}/delete`, "POST", {}), env)).status,
    ).toBe(401);
    const otherCookie = await confirmed("other@example.com", "b".repeat(64));
    expect(
      (
        await communityApi(
          request(`/${id}/delete`, "POST", {}, otherCookie),
          env,
        )
      ).status,
    ).toBe(401);
    const response = await communityApi(
      request(`/${id}/delete`, "POST", {}, savedCookie),
      env,
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ id, deleted: true });
    const deleted = database
      .prepare("SELECT * FROM community_builds WHERE id = ?")
      .get(id)!;
    expect(deleted).toMatchObject({
      ...original,
      state: "deleted",
      deleted_at: expect.any(Number),
      updated_at: expect.any(Number),
    });
    expect(
      (
        await communityApi(
          request(`/${id}/delete`, "POST", {}, savedCookie),
          env,
        )
      ).status,
    ).toBe(200);
    expect(
      database.prepare("SELECT * FROM community_builds WHERE id = ?").get(id),
    ).toEqual(deleted);
    expect((await communityApi(request(`/${id}`), env)).status).toBe(404);
    expect(
      (
        await communityApi(
          request(`/${id}/edit`, "GET", undefined, savedCookie),
          env,
        )
      ).status,
    ).toBe(404);
    expect(
      await (await communityApi(request("?q=Aurora&tag=Solo"), env)).json(),
    ).toEqual({ builds: [], hasMore: false });
    expect(await (await communityApi(request("/tags"), env)).json()).toEqual({
      tags: [],
    });
    expect(
      (
        await communityApi(
          request(
            `/${id}`,
            "PUT",
            { ...draft(), state: "published" },
            savedCookie,
          ),
          env,
        )
      ).status,
    ).toBe(404);
    expect(
      (
        await communityApi(
          request(`/${id}/restore`, "POST", {}, savedCookie),
          env,
        )
      ).status,
    ).toBe(404);
    expect(
      (
        await communityApi(
          request(
            "",
            "POST",
            { ...draft(), build: JSON.parse(original.build_json as string) },
            savedCookie,
            original.publish_key as string,
          ),
          env,
        )
      ).status,
    ).toBe(409);
    expect(
      database
        .prepare("SELECT state FROM community_builds WHERE id = ?")
        .get(id)?.state,
    ).toBe("deleted");
    // Only an operator using D1 directly can reinstate the retained row.
    database
      .prepare(
        "UPDATE community_builds SET state = 'published', deleted_at = NULL WHERE id = ?",
      )
      .run(id);
    expect((await communityApi(request(`/${id}`), env)).status).toBe(200);
    expect(
      (
        await communityApi(
          request(`/${id}/edit`, "GET", undefined, savedCookie),
          env,
        )
      ).status,
    ).toBe(200);
  });
  it("cannot confirm a pending edit code after the build was deleted", async () => {
    const id = await post();
    database
      .prepare(
        "UPDATE community_email_challenges SET created_at = created_at - 31",
      )
      .run();
    const c = await challenge("creator@example.com", id);
    await communityApi(request(`/${id}/delete`, "POST", {}, savedCookie), env);
    expect((await verify(c.id, c.code!, "c".repeat(64))).status).toBe(401);
    database
      .prepare(
        "UPDATE community_email_challenges SET created_at = created_at - 31",
      )
      .run();
    mail.mockClear();
    expect(
      (
        await communityApi(
          request("/auth/request", "POST", {
            email: "creator@example.com",
            buildId: id,
            requestId: crypto.randomUUID(),
          }),
          env,
        )
      ).status,
    ).toBe(200);
    expect(mail).not.toHaveBeenCalled();
  });
  it("reports missing email configuration and delivery failures without granting access", async () => {
    const data = {
      email: "creator@example.com",
      requestId: crypto.randomUUID(),
    };
    expect(
      (
        await communityApi(request("/auth/request", "POST", data), {
          ...env,
          RESEND_API_KEY: undefined,
        })
      ).status,
    ).toBe(503);
    mail.mockRejectedValue(new Error("Delivery failed"));
    expect(
      (await communityApi(request("/auth/request", "POST", data), env)).status,
    ).toBe(503);
    expect(
      database
        .prepare("SELECT COUNT(*) AS count FROM community_email_challenges")
        .get()?.count,
    ).toBe(0);
    expect((await communityApi(request("", "POST", draft()), env)).status).toBe(
      401,
    );
    mail.mockResolvedValue({ id: "retry" });
    expect(
      (await communityApi(request("/auth/request", "POST", data), env)).status,
    ).toBe(200);
  });
});

it("publishes, reads and edits all variants, including equipment only in a variant", async () => {
  const cookie = await confirmed();
  const data = draft();
  const added = addBuildVariant(data.build);
  data.build = added.build;
  data.build.slots = emptyBuild().slots;
  data.build.variants![0].name = "Boss fights";
  const response = await communityApi(request("", "POST", data, cookie), env);
  expect(response.status).toBe(201);
  const { id } = (await response.json()) as { id: string };
  const published = (await (
    await communityApi(request(`/${id}`), env)
  ).json()) as { build: typeof data.build };
  expect(published.build.variants).toEqual(data.build.variants);
  data.build.variants![0].name = "Grinding";
  expect(
    (await communityApi(request(`/${id}`, "PUT", data, cookie), env)).status,
  ).toBe(200);
  const edited = (await (
    await communityApi(request(`/${id}`), env)
  ).json()) as { build: typeof data.build };
  expect(edited.build.variants?.[0].name).toBe("Grinding");
  expect(edited.build.slots.ranged).toBeNull();
  expect(edited.build.variants?.[0].slots.ranged?.itemSlug).toBe(
    "winter-touch",
  );
});
