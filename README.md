# NexaKit Pro — UI/UX + Security + SEO Upgrade

Existing tools, API routes, Supabase authentication and Vercel functions are preserved.

### Upgrade
- Simple neumorphism UI, responsive desktop/mobile layout, accessible focus states.
- Search/category UI, redesigned tool cards, workspace input cards.
- Boot/loading state, offline indicator, reduced-motion support and Ctrl/Cmd+K search shortcut.
- SEO description, canonical, Open Graph, Twitter metadata and WebApplication JSON-LD.
- JavaScript/CSS externalized; CSP no longer needs inline scripts.
- Stronger CSP plus COOP/CORP, frame restrictions, form restrictions and HTTPS upgrade.
- Service-worker cache refreshed for new assets.
- Avatar upload type/size validation and client-side compression.
- No new runtime dependency.

### Security note
The Supabase publishable key is intentionally served to the browser through `/api/supabase-config`; this is normal for a publishable Supabase client key. Database security must remain enforced by Supabase RLS policies. Secret API keys stay in Vercel environment variables.
