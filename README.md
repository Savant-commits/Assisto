# Assisto

Assisto is a Next.js App Router application for discovering local home-service professionals. It uses Supabase for authentication and data, Tailwind CSS v4/shadcn design tokens, Photon for location search, and Leaflet/OpenStreetMap for maps.

## Development

Copy `.env.example` to `.env.local`, configure the required values, then use:

- `npm run dev` — local development server
- `npx next typegen && npx tsc --noEmit` — route type generation and TypeScript check
- `npx eslint` — lint
- `npm run build` — production build

Do not commit `.env` or `.env.local`. Values prefixed with `NEXT_PUBLIC_` are compiled for browser use. The Supabase anon/publishable key is public by design and relies on database RLS; service-role and email-provider keys are server-only secrets and must never use the `NEXT_PUBLIC_` prefix.

## Environment variables

| Variable | Exposure | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Public | Supabase project URL; required by Supabase clients. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public | Supabase anon/publishable key; RLS must protect data. |
| `NEXT_PUBLIC_SITE_URL` | Public | Site origin used to construct signup confirmation URLs; locally defaults to `http://localhost:3000`. |
| `NEXT_PUBLIC_MAP_TILE_URL` | Public, optional | Leaflet tile URL template; defaults to OpenStreetMap. |
| `NEXT_PUBLIC_MAP_ATTRIBUTION` | Public, optional | Map attribution markup. |
| `GEOCODER_BASE_URL` | Server-only, optional | Photon-compatible geocoder origin; defaults to `https://photon.komoot.io`. Treat as trusted deployment configuration, never request input. |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only secret | Admin-only database client; bypasses RLS. Never expose or log. |
| `RESEND_API_KEY` | Server-only secret | Outbound email API key. |
| `EMAIL_FROM` | Server-only | Verified sender address for outbound email. |
| `REQUIRE_PHONE_VERIFICATION` | Server-only, optional | Set to `true` to require phone verification; defaults to false. |

## Design tokens and themes

Global semantic color, border, radius, typography, and shadow tokens are defined in `app/globals.css` and mapped to Tailwind utilities in its `@theme inline` block. Prefer semantic classes such as `bg-background`, `text-foreground`, `bg-card`, `text-muted-foreground`, `bg-primary`, `text-primary-foreground`, `border-border`, `ring-ring`, `bg-destructive`, `font-display`, `shadow-soft`, and `shadow-lifted` over fixed palette colors. `.dark` overrides the semantic values.

The theme preference key is `assisto-theme` in `localStorage`: `light` or `dark` is stored explicitly; System removes the key and follows the operating-system setting. It contains only a display preference.

## Location persistence and geocoding

The selected location is stored in the `assisto-location` browser cookie. It is JavaScript-readable, lasts one year, and contains the selected label/locality/city/state, source, and coordinates. Device-derived coordinates are rounded to three decimal places before storage; other map/search selections may retain more precision. Treat the cookie and the `assisto-recent-locations` localStorage list (up to five locations) as privacy-sensitive location data, not as authentication credentials. Recent search text is stored separately under `assisto-recent-searches`.

The public API routes are:

- `GET /api/geocode/search?q=...` — accepts 3–100 characters, asks the configured Photon service for up to eight results, and normalizes results to Tamil Nadu.
- `GET /api/geocode/reverse?lat=...&lng=...` — validates numeric coordinates and returns a normalized Tamil Nadu place or `null`.

Both routes use a 6-second upstream timeout, request caching/revalidation for 24 hours, public cache headers with stale revalidation, and an in-memory limit of 30 requests per minute per derived client-IP value. That limiter is process-local and depends on the deployment ingress sanitizing forwarded-IP headers; it is best-effort, not a distributed abuse-control boundary. Neither API accepts a destination URL. Search terms and reverse coordinates are sent to the configured geocoder.

## Homepage component map

`app/page.tsx` composes the homepage and its server-loaded sections:

- `components/home/home-refresh.tsx` — stale-page refresh and pull-to-refresh behavior.
- `components/home/coverage-notice.tsx` — local-coverage status and nearby providers.
- `components/home/hero-section.tsx` and `components/home/hero-carousel.tsx` — data-filtered, accessible featured carousel; only the initial hero image is priority-loaded, later slides are lazy.
- `components/home/service-categories.tsx`, `components/home/popular-services.tsx`, `components/home/category-rail.tsx`, and `components/home/image-card.tsx` — Our Services and location-aware popular categories.
- `components/home/provider-recruitment.tsx` — recruitment banner for eligible users.
- `components/search/home-search-bar.tsx` and `components/location/location-selector.tsx` — the combined search/location bar, rendered by `components/shell/app-header.tsx` only on `/`.
- `components/shell/app-header.tsx` and `components/shell/bottom-nav.tsx` — main-tab shell; shared nav destinations are in `components/shell/navigation-items.ts`.

The home categories and provider rows are queried by `lib/home/queries.ts` using the browser/session Supabase client on the server. They require appropriate anon grants and RLS policies. The checked-in SQL includes public profile/provider select policies (`sql/005_enable_rls_policies.sql`); application filters such as `providers.is_active = true` are query filters, not substitutes for RLS.

## Security and database audit notes

`lib/supabase/admin.ts` imports `server-only` and is the only source use of `SUPABASE_SERVICE_ROLE_KEY`. Browser code uses only the public anon key. Login/signup redirects are normalized by `lib/safe-redirect.ts`; the auth sheet captures the current relative pathname and query.

The checked-in `sql/038d.sql` grants `anon` and `authenticated` column-level SELECT on `profiles`, including `email` and `is_admin`, while `sql/005_enable_rls_policies.sql` has a public profile row policy. A later `sql/38g_apply.sql` drops `is_admin`; the email grant is not revoked in the tracked migrations. This is broader than a “profiles are own-row only” assumption. Before changing grants, confirm live grants, columns, and app dependencies. **Proposal only; not applied:** revoke anonymous/authenticated column SELECT on `profiles.email` if public email access is not intended. The existing public profile row policy can remain for non-sensitive discovery fields if desired.

The public provider SELECT policy is also broad (`USING (true)`); the homepage filters active rows in its query. If inactive provider rows must not be public, design a replacement policy that preserves owner/admin access and test it against the deployed schema before applying. No schema or RLS changes are included here.

The `public.popular_categories` RPC is maintained outside this repository (see `public/images/README.md`); its deployed definition, execute ACL for `anon`, and complete return shape are not verifiable from this source tree. The UI consumes category-like fields, but that does not prove the RPC returns only aggregate, non-personal data. Verify its deployed definition and `anon` execution privilege; keep its result category-level and free of user identifiers/contact/profile fields. Homepage category/provider relation policies and requirement visibility also need a live-policy check because not every policy is represented by a tracked migration.

## Performance notes

Hero and category cards use explicit aspect ratios; non-hero images do not request priority. Skeletons reserve image/card geometry, though variable coverage/popular content can still cause some section-height shift. Fraunces currently uses `next/font/google` in `app/layout.tsx`; consider downloading and self-hosting licensed font files with `next/font/local` to remove build/runtime dependence on Google Fonts. No font migration is included.
