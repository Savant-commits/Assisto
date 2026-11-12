# Homepage image assets

Place these optional local JPEG assets in the listed directories. The homepage provides a tinted fallback when an image is unavailable.

## Hero banners — 1920 × 1080

- `hero/find-professionals.jpg`
- `hero/build-dream-home.jpg`
- `hero/design-your-space.jpg`
- `hero/everyday-home-services.jpg`
- `hero/home-improvement.jpg`
- `hero/join-assisto.jpg`

## Service categories — 800 × 1000

- `categories/construction.jpg`
- `categories/civil-engineering.jpg`
- `categories/interior.jpg`
- `categories/exterior.jpg`
- `categories/renovation.jpg`

## Provider recruitment — 1600 × 1200

- `join/professional-at-work.jpg`

The optional `GEOCODER_BASE_URL` environment variable configures the geocoder endpoint.

Homepage database dependencies maintained outside this repository:

- Function `public.popular_categories(text, int, int)` (the page calls it with `p_city` and `p_limit`; no request count is displayed).
- Trigger `notify_welcome_on_signup` on `profiles`.
- `welcome` included in the `notifications_type_check` constraint.

Known limitation: “Use current location” can be imprecise on desktops.
