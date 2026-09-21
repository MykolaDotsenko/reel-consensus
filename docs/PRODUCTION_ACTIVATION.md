# Production Activation Runbook

_Last reviewed: 2026-09-21_

This runbook is the release gate between “production-ready code” and an actually live Reel Consensus deployment.

## Current external blockers

The repository is production-ready, but activation requires resources that are intentionally **not** stored in GitHub:

- a Vercel project imported from `MykolaDotsenko/reel-consensus`;
- a Supabase project with anonymous authentication enabled;
- Supabase migrations `0001` and `0002` applied;
- a TMDB API Read Access Token;
- optional OpenRouter API key.

No service-role key or TMDB token may be committed to the repository.

## 1. Import the GitHub repository into Vercel

Use the existing Deploy with Vercel action in the README, or import:

```text
MykolaDotsenko/reel-consensus
```

Expected project settings:

- Framework: Vite
- Production branch: `main`
- Output directory: `dist`
- Node.js: 22.x

The repository already contains `vercel.json`.

## 2. Configure Supabase

Enable Anonymous Sign-Ins.

Apply migrations in order:

```text
supabase/migrations/0001_shareable_rooms.sql
supabase/migrations/0002_playback_context.sql
```

Then configure Vercel:

```text
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
```

These are public client values. Never use a Supabase service-role key in the browser.

## 3. Configure TMDB

Create a TMDB API Read Access Token and configure the **server-side** Vercel environment variable:

```text
TMDB_ACCESS_TOKEN
```

Never rename this to `VITE_TMDB_ACCESS_TOKEN`.

## 4. Optional AI

For AI-assisted brief interpretation:

```text
OPENROUTER_API_KEY
OPENROUTER_MODEL   # optional override
```

The deterministic local parser remains the fallback.

## 5. Redeploy main

Environment-variable changes should be followed by a new production deployment so Vite receives the Supabase public variables at build time.

## 6. Machine verification

The deployment exposes:

```text
GET /api/health
```

It reports capability booleans only; it never returns credential values.

Run:

```bash
npm run verify:production -- \
  --url https://<deployment>.vercel.app \
  --require-live-catalog true \
  --require-shared-rooms true
```

The smoke test verifies:

- root application is serving Reel Consensus;
- health endpoint is correct;
- TMDB capability is configured;
- Finland provider directory is reachable;
- Finland catalogue query succeeds;
- returned live movies obey Finland availability invariants;
- Supabase public room configuration is present.

The same verification can be launched manually from GitHub Actions via **Production smoke**.

## 7. Human/browser verification

Machine smoke cannot prove the Supabase migration and anonymous-auth behavior by itself. Before serious traffic:

1. Create a shared room on device/browser A.
2. Share the invite to browser B.
3. Join without registration.
4. Change preferences on B and verify A updates.
5. Set country to Finland and select actual services.
6. Verify both devices converge on the same playback context.
7. Refresh both devices and verify room recovery.
8. Mark both participants ready.
9. Run a decision.
10. Confirm every live result has valid provider availability for Finland.

## Release gate

Do not mark the product “production activated” until all three are true:

- Vercel deployment is READY on `main`;
- production smoke passes with live catalogue + shared rooms required;
- two-browser room test passes.

Only then proceed to saved-group/history work.
