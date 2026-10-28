# Cloudflare legacy address

`https://legacy.mddex.net` is a Workers Custom Domain attached directly to Worker
`mddex` in the production Cloudflare account. Cloudflare manages its proxied DNS
record and TLS certificate. It does not depend on the apex hostname's DNS.

Both `mddex.net` and `legacy.mddex.net` currently invoke the same Worker and use
the same production bindings. Keep the legacy route in `wrangler.jsonc` so later
Cloudflare deployments retain this fallback address. When the apex moves to
Sites, remove only the apex Worker custom-domain binding as part of that
separately authorized cutover; keep the legacy binding.

The subdomain has independent browser storage and host-only session cookies.
Existing `mddex.net` loadouts do not automatically appear there. Export/import
loadout backups before relying on the legacy address for local builds. Keeping
exactly `https://mddex.net` through the hosting cutover preserves that browser's
storage origin. The bulk backup feature is prepared in
[PR #1](https://github.com/lukivan8/mddex/pull/1) and needs a separate release.

This is an alternate address for the current Cloudflare deployment, not a frozen
release or database snapshot. The content CDN remains `cdn.mddex.net`.
