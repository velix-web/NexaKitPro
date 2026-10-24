# NextGen 1

All-in-one tools workspace: downloaders, makers, image tools and lookups behind a
Supabase login, with role/VVIP/ban enforcement done **server-side**.

Stack: static HTML/CSS/JS + Vercel Functions (`/api`, Edge runtime except the two
`brat*` Node functions) + Supabase (Auth, Postgres, RLS). No build step.

## Layout
| Path | What |
|---|---|
| `index.html`, `app.js`, `auth.js`, `ui.js` | App shell. `auth.js` = session, dashboard, navigation (module); `app.js` = per-tool forms/results (classic); `ui.js` = shared modal/confirm/toast helpers |
| `admin.html`, `admin.js` | Admin panel (UI only — every action is re-authorized by `/api/admin`) |
| `styles.css` (+ `admin.css`, `legal.css`, `error.css`) | Design system: white/gray gradient + glass, light & dark |
| `api/_auth.js`, `api/_auth-node.js` | **The authorization boundary** for tool endpoints (Edge / Node twins) |
| `api/proxy.js` | Fixed-host provider proxy. Never takes a URL from the client |
| `api/admin.js` | Only place the service-role key is used; re-checks role on every call |
| `supabase/schema.sql` | Idempotent schema + RLS (safe to re-run) |
| `scripts/` | `npm test` validators (see below) |

## Security model (what is actually enforced, and where)
- Every tool endpoint calls `authenticate()` → validates the bearer token with Supabase, then re-reads **the caller's own** `profiles` row (RLS-scoped, anon key — no service role) and rejects banned users. Nothing about role/VIP/ban is ever taken from the client.
- `enforceToolAccess()` / `proxy.js` re-read `tool_status` on every request: disabled, maintenance and VVIP-only are decided server-side.
- **Fail closed:** if the status lookup fails, times out or returns something malformed, the request is denied (503) — even for admins/VIPs. Only a *confirmed* "no row" means "schema defaults".
- `proxy.js` cross-checks `slug ↔ provider` against `BUILT_IN_SLUG_PROVIDERS` (or `custom_tools`), so a free tool's slug can't be paired with a VVIP provider.
- `img2link` has its own endpoint with a hard-coded slug; the shared `imgbb-upload` endpoint never trusts a client-supplied slug.
- Uploads: size cap, MIME allowlist and **magic-byte** check. Downloads: only `http(s)` or same-origin paths are ever opened.
- SSRF: `ssweb` rejects loopback/private/link-local/metadata targets incl. encoded IPs (see limitations).
- CSP has no `unsafe-inline` for styles → **no `style=""` attributes anywhere** (enforced by `npm test`).

## VVIP & roles
- **Owner** grants/revokes VVIP per user (Admin panel → Users → VVIP) via `users.setVip`; enforced server-side, audit-logged. Admin/Owner roles already include VVIP access, so the flag is only meaningful for `user`.
- Admins moderate regular users; only an Owner can ban an Admin, change roles, set VVIP or delete users; nobody can ban an Owner (demote first).
- A user's own client can never change `role`/`is_vip`/`banned` (database trigger + RLS); only the service-role admin API can.

## Adding / changing a tool
1. `app.js` → `TOOLS` (slug, title, provider, paramKey, icon — icons must be unique).
2. `api/proxy.js` → `PROVIDERS` (upstream URL) and `BUILT_IN_SLUG_PROVIDERS` (slug → providers).
3. `api/admin.js` → `TOOL_CATALOG` (so admins can toggle it) and, if it fits the generic custom-tool templates, `ALLOWED_PROVIDERS` + the `admin.html` dropdown.
4. `auth.js` → `cat()` (category) and `HEALTH_SOURCES` (label).
5. `npm test` — it fails loudly on any mismatch.

## Tests
`npm test` runs: icon uniqueness, tool/provider/admin consistency (+ CSP inline-style guard), and
`scripts/check-security.js` — the real handlers against a mocked Supabase (auth, ban, VVIP, fail-closed,
provider/slug tampering, upload spoofing, SSRF cases, URL safety, outage-vs-invalid-session) and
`scripts/check-admin.js` — the real `api/admin.js` against a PostgREST-faithful mock (owner-only VVIP, role/ban hierarchy,
pagination, "ok for ids that don't exist", the empty-body-201 bug).
`npm run test:rls` proves the RLS/trigger hardening on a real throwaway PostgreSQL.
`npm run smoke` (needs `npm i`, uses jsdom) renders every tool form in a DOM and fails on any runtime error.

## Deploy
Env vars: `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (admin only), `IMGBB_API_KEY`,
`REMOVEBG_API_KEY`, `FAZZCODE_API_KEY`, optional `TELEGRAM_BOT_TOKEN`/`TELEGRAM_CHAT_ID`.
Run `supabase/schema.sql` in the SQL editor after each deploy that changes it.

## Known limitations
- **Rate limiting is per-instance, in-memory** — it dampens abuse, it is not a distributed guarantee. Upgrade path: swap the body of `api/_ratelimit.js` for an Upstash Redis check (all callers already use `rateLimit(req, opts)`).
- **SSRF:** hostnames are not DNS-resolved (Edge runtime can't), so DNS rebinding isn't covered; mitigated because `ssweb` only forwards the URL to a third-party renderer.
- Upstream third-party APIs (nexray, kyzznekoo, theresav, …) are outside our control; parameter names for the newer ones are best-effort and must be verified against live responses.
- The internal Supabase login email domain `users.nexakitpro.local` and the `nexakitpro.my.id` host are intentionally unchanged (renaming would lock out existing accounts / break the deployment).
