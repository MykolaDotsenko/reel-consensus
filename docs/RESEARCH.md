# External Constraints and Research Notes

_Last verified: 2026-09-21_

This file records external platform facts that materially affect the product architecture. Re-check before commercial launch because APIs, pricing and terms can change.

---

## TMDB

### Developer / commercial use

TMDB states that its API is free for non-commercial use with attribution. Projects whose primary purpose is revenue are considered commercial and should contact TMDB for a commercial arrangement.

Official reference:

- https://developer.themoviedb.org/docs/faq

### Attribution

TMDB requires approved TMDB branding and a notice in an About/Credits-type area:

> This product uses the TMDB API but is not endorsed or certified by TMDB.

Re-check exact wording/brand rules before launch.

### Discover

TMDB movie discovery supports filters including:

- `watch_region`;
- `with_watch_providers`;
- `with_watch_monetization_types`;
- genre;
- runtime;
- rating;
- release region.

Official reference:

- https://developer.themoviedb.org/reference/discover-movie

### Watch providers

TMDB exposes streaming/rental/purchase availability per country using data from its JustWatch partnership.

Important:

- JustWatch attribution is required;
- responses are sufficient to display where content is available;
- they do not provide full streaming-service deep links.

Official reference:

- https://developer.themoviedb.org/reference/movie-watch-providers

### Append to response

Movie details support `append_to_response` to combine subrequests into one details request.

Official references:

- https://developer.themoviedb.org/docs/append-to-response
- https://developer.themoviedb.org/reference/movie-details

### Rate limiting

TMDB says the legacy 40 requests / 10 seconds rule is disabled, but an upper limit around 40 requests/second still exists for bulk-abuse protection and may change.

Official reference:

- https://developer.themoviedb.org/docs/rate-limiting

---

## JustWatch

JustWatch offers a Content Partner API under a partner relationship / contract.

Official references:

- https://apis.justwatch.com/docs/
- https://apis.justwatch.com/docs/api/
- https://partners.justwatch.com/

Do not base Reel Consensus on unofficial scraping.

---

## Watchmode

As of the review date, Watchmode advertises:

- free developer tier: 2,500 monthly credits;
- non-commercial;
- up to 3 countries;
- attribution required;
- commercial Startup tier listed at $349/month.

Official reference:

- https://api.watchmode.com/

Treat current pricing as volatile; re-check before making a commercial provider decision.

---

## Supabase anonymous authentication

Supabase supports anonymous sign-in with no email/password/PII requirement.

Anonymous users:

- receive a normal authenticated user ID/session;
- use the authenticated Postgres role;
- can later link a permanent identity;
- cannot recover the same anonymous identity after clearing local browser data unless upgraded.

Official references:

- https://supabase.com/docs/guides/auth/auth-anonymous
- https://supabase.com/docs/guides/auth/users

---

## Supabase Realtime

Realtime supports:

- Broadcast;
- Presence;
- Postgres Changes.

Presence is suited to low-frequency state such as online participants, not high-frequency cursor-like streams.

Official references:

- https://supabase.com/docs/guides/realtime
- https://supabase.com/docs/guides/realtime/presence

### Realtime authorization

Supabase supports RLS-backed authorization for private Broadcast and Presence channels.

Official reference:

- https://supabase.com/docs/guides/realtime/authorization

---

## Supabase early-stage capacity

At review time, Supabase documents free-plan allowances including:

- 500 MB database;
- 50,000 MAU;
- 2 million Realtime messages;
- 200 peak Realtime connections.

Official reference:

- https://supabase.com/docs/guides/platform/billing-on-supabase

These are enough for product validation, not a reason to avoid capacity planning.

---

## Scheduled cleanup

Hosted Supabase supports scheduled function invocation via Postgres `pg_cron` + `pg_net`.

Useful for:

- expiring temporary rooms;
- stale invite cleanup;
- cache refresh;
- retention cleanup.

Official reference:

- https://supabase.com/docs/guides/functions/schedule-functions

---

## Review rule

Before a commercial/public launch, re-check:

- TMDB terms;
- commercial license status;
- JustWatch attribution;
- provider-linking rights;
- Supabase limits/pricing;
- OpenRouter terms/model availability;
- privacy/GDPR obligations.

No external dependency in Reel Consensus should be considered permanent without an adapter boundary.
