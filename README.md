# NexaKit Pro — Production Native Toolkit

Vanilla HTML/CSS/JavaScript + Vercel Edge API routes + Supabase Auth. The existing tool/API architecture is preserved; the frontend has been rebuilt around a responsive, themed workspace UI.

## Supabase setup

1. Create/use the Supabase project configured for NexaKit Pro.
2. In **Authentication → Providers → Email**, enable Email provider and **disable Confirm email** if you want the requested username+password flow with no email/OTP step.
3. Run `supabase/schema.sql` in the Supabase SQL Editor.
4. Add the environment variables below in Vercel.

The browser never receives a service-role/secret key. The publishable key is safe to expose to the Supabase client; the config route only returns the public project URL and publishable key.

### Environment variables

```text
SUPABASE_URL=https://qcoazogtpidorxdingkm.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
IMGBB_API_KEY=...
FAZZCODE_API_KEY=...
REMOVEBG_API_KEY=...
TELEGRAM_BOT_TOKEN=...
TELEGRAM_ADMIN_CHAT_ID=...
```

`VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` are also accepted by `/api/supabase-config.js`, but because this project is native/static HTML rather than a Vite build, the recommended names are the server environment variables above.

## Username authentication

Users enter only a username and password. Internally, the frontend maps the username to a deterministic non-mailbox identity used by Supabase Auth. Passwords are never stored in localStorage or in the `profiles` table. Supabase owns password hashing/session handling.

## Existing tools

The original Vercel API routes are preserved. The UI dynamically renders the existing tools and applies tool-specific accent themes. No mock download implementation was introduced.

## Deploy

1. Import the project into Vercel.
2. Add the environment variables.
3. Deploy.
4. Open the deployed URL and test register, login, logout, refresh, and several tools.

`index.html` should not be opened via `file://` for API/auth testing; serve it through Vercel or another web server.
