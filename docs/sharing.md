# Anonymous identity and permanent build links

## User experience

Editing, naming, equipment selection, effects, and local saves never wait for a network request. The header warms an anonymous session in the background. The current build token is encoded locally in advance, but editing and build creation never upload snapshots or reserve server records.

The first Share request stores exactly the state captured by that click. The clipboard operation begins in the click gesture using a promise-backed ClipboardItem and receives the short URL only after the server confirms durable storage. The button shows Sharing… while this first request is pending, then Link copied for three seconds. Subsequent shares of the same state reuse the confirmed link immediately, including offline. Recent confirmed ID/token pairs are cached locally. Identical submissions by the same user are idempotent, including concurrent requests and retries.

If storage fails, the operation copies the existing self-contained compressed URL instead. An offline first share uses this fallback immediately. No unresolved short ID is copied. The first uncached short link requires one network round trip; reserving an ID earlier cannot remove the need to persist its actual snapshot before making it available to recipients. No intermediate build states are uploaded, and no future snapshot is reserved after Share.

Short-link recipients load an immutable token from D1 and use the same decoder and normal build workspace as legacy fragment links. The creator's device can resolve confirmed links locally. Fresh visits start resolution alongside catalog and local-database loading, sharing the same in-flight request with the workspace. Other visitors inherently require a network fetch the first time; responses are publicly cacheable because tokens never change. Missing/error responses aren't cached. Load failures preserve local builds. Save locally imports a separate editable build and removes both share query parameters and legacy build fragments.

## Storage and identity

- `users`: random anonymous user ID, nullable unique account ID, creation time. Future account creation can attach to this identity; signing into an existing account will require a separate authenticated merge flow.
- `anonymous_sessions`: SHA-256 credential hash, user ID, expiration. The browser receives only an HttpOnly, SameSite=Lax cookie; HTTPS uses Secure and the __Host- prefix. Identity visits renew its one-year lifetime.
- `build_links`: random 128-bit URL-safe ID, existing versioned compressed token, token hash, creator ID, creation time. No expiration or update endpoint. Unique creator/token hash provides retry deduplication.

`mddex.identity.v1` stores the public ID locally for future migration association. It is not an authentication credential and never authorizes requests. Existing browser builds stay untouched; no cloud synchronization or account login is introduced here. Clearing cookies starts a new anonymous identity; local records can still be uploaded during a future authenticated migration.

## API and consistency

- POST `/api/identity`: issue or recover the anonymous user using its cookie.
- POST `/api/build-links`: authenticated, same-origin JSON request; validate bounded payload and decoder format; return ID only after committed storage.
- GET `/api/build-links/:id`: public token resolution, independent of the creator's session.

All D1 request sessions start with `first-primary`, including fresh link resolution, to avoid replica propagation delays. Queries are parameterized. Creation is rate limited using Cloudflare's native binding, keyed by user; new identity creation uses a separate IP bucket. Credentials and build tokens aren't logged. Bodies and decompressed payloads have explicit bounds.

## Resources and rollout

Worker: `mddex`, account `969c1ae807b3ae3d635b9c72c0818e54`.
D1: `mddex-builds`, binding `BUILD_DB`, database `512cfa53-a2a4-4ae2-8d88-e88bd434a1c9`.
Migration: `migrations/0001_anonymous_build_links.sql` (additive new schema).

Run `npm run db:migrate:local` before a fresh local development session. Browser tests apply local migrations automatically. Run `npm run db:migrate:remote` before deploying the Worker. `npm run cf:types` regenerates binding types. The remote database and first migration are provisioned. This version is deployed to mddex.net as Worker version `0b0e033e-5e81-45f4-a3d3-5405deb262c0`.

Existing compressed links remain supported. If an older Worker lacks these endpoints, background requests fail safely and sharing continues using compressed links.
