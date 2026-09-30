# Community builds

The top-right Community builds tab opens `/community`. Published build snapshots,
creator notes, tags, and public creator identities are stored in the existing D1
database. Local builder loadouts stay in browser storage. The gallery supports
search, tag filtering, and pagination; each build has a centered read view and can
be copied into the local builder.

## Database

Apply `0002_community_builds.sql`, `0003_community_identity.sql`, and
`0004_community_deleted_state.sql`, and `0005_community_profiles.sql` using `npm run db:migrate:local` locally. Apply
the existing `npm run db:migrate:remote` deployment migration workflow before
deploying this feature. Migrations 0002–0005 were applied to production on 2026-09-30.

## Email configuration

Publishing and editing use Resend's transactional HTTP API for six-digit OTPs.
`COMMUNITY_EMAIL_FROM` in `wrangler.jsonc` is `builds@mddex.net`; verify `mddex.net`
in Resend and add the exact DNS records Resend provides before enabling delivery.
Store a sending-only API key with `npx wrangler secret put RESEND_API_KEY`.
The API key is server-only and must never use a `VITE_` prefix or be committed.
For local real delivery, put `RESEND_API_KEY=re_...` in ignored `.dev.vars`.
`mddex.net` is verified in Resend; a sending-only key restricted to that domain
is installed as the production Worker secret and in local `.dev.vars`. The provider
setup is complete; the community feature was deployed to production on 2026-09-30.
Without a key, confirmation fails closed; local development does not send emails.

The branded template in `community.email.ts` includes inline email-safe styles,
MDDEX colors and logo, a selectable code, a 10-minute expiry notice, and a plain-text
alternative. Publish and edit messages describe the appropriate action. Resend
receives a stable challenge-based `Idempotency-Key`. Sending errors expose no
provider response or recipient information to visitors or logs. Request timeouts
are bounded to 10 seconds. Tests mock the HTTP boundary; no real OTPs are sent.

The email address is excluded from every public build response. Codes expire after
10 minutes and allow five guesses. Their hashes are salted with the random challenge
ID. Requests are limited by IP and by email (five per hour, at least 30 seconds apart).
Edit challenges send only to the build owner's email and give the same response shape
for nonmatching addresses.

A correct code is exchanged for an email identity session lasting seven days. Its
credential is stored in an HttpOnly, SameSite=Strict cookie (Secure on HTTPS); only a
SHA-256 hash is stored in D1. The session permits posting with that email and editing
any build owned by that email. Expiration requires a new code. The remembered email,
display name, and Discord are stored separately in versioned localStorage after
confirmation and survive session expiration; these local values grant no access.

`POST /auth/request` accepts a client-generated UUID request ID. Retries return the
same challenge without sending another email. Verification binds the consumed code
to a random 256-bit client credential, so an exact retry recovers the same session
without extending its expiration. A different credential cannot reuse the code.

Publishing requires an `Idempotency-Key` UUID. D1 enforces uniqueness per owner email;
identical retries return the existing build ID and changed payloads return 409. The
browser retains the request ID and draft fingerprint in sessionStorage to recover
from lost responses and reloads. Missing mail configuration or failed delivery never
bypasses confirmation. The former build-specific confirmation links are retired.

Descriptions are stored as validated structured text (paragraphs, headings, bold,
italic, and lists), rendered through React without executing raw HTML. Writes require
same-origin JSON, bounded payloads, and the existing Cloudflare rate limiter.

## Deleted builds

The editor's top Delete build action marks the row `state = 'deleted'` and records
`deleted_at`; it never removes the build or its equipment, description, or ownership.
Deletion requires the owner's confirmed email session and is idempotent. Deleted
builds are excluded from listings, search, tag suggestions, public detail, and editing.
Pending edit codes cannot authorize a deleted build. Editing or retrying an old
publishing request cannot restore it. Local loadouts remain available.

There is no restoration endpoint or visitor-facing control. The site owner can
restore a retained build manually in the Cloudflare D1 console, selecting the
`mddex-builds` database and the exact build ID:

```sql
UPDATE community_builds
SET state = 'published', deleted_at = NULL, updated_at = unixepoch()
WHERE id = 'BUILD_UUID' AND state = 'deleted';
```

Apply the new migration before deploying code that uses the state column. Production migrations were applied on 2026-09-30. The temporary preview post was
soft-deleted locally and was never present in production.

## Validation

`src/features/community/community.server.test.ts` exercises real SQL against an
in-memory SQLite database and mocks only mail delivery and the D1 binding adapter.
`e2e/community.spec.ts` checks browser navigation, posting, builder return, and
responsive layouts with controlled API/catalog fixtures. Local D1 migration is also
verified with Wrangler. Actual mail delivery requires a verified Resend sender and the Worker secret.

## Display-name ownership

A verified email owns one immutable display name in `community_profiles`, with a
unique normalized name key (trimmed, Unicode NFKC, case insensitive). A first
confirmed publish reserves the name atomically. Subsequent posts and edits must
use that name; mismatches return 409 with email and display-name field errors.
The session endpoint returns the current verified email's name for automatic
form filling. No public email lookup or account interface is added. Ownership
survives seven-day session expiry and soft deletion.

Migration 0005 preserves the earliest posted name for each existing creator,
including deleted builds. Conflicting legacy names cause migration failure and
require manual resolution instead of silently transferring name ownership.
Apply it locally before development and remotely before production deployment.
