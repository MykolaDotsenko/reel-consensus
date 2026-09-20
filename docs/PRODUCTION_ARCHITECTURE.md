# Production Architecture

_Last reviewed: 2026-09-21_

This document translates the product-success blueprint into a production architecture while preserving Reel Consensus’s core rule:

> **External systems provide facts and interpretation. The deterministic decision engine makes the final ranking.**

---

# Recommended stack

## Client

Keep:

- React 19;
- TypeScript;
- Vite;
- Playwright/Vitest.

No framework migration is required to implement the product roadmap.

## API / BFF

Keep Vercel Functions as the server-side boundary for:

- TMDB credentials;
- OpenRouter credentials;
- catalogue normalization;
- candidate discovery;
- cache orchestration;
- abuse/rate limits;
- server-only decision orchestration where needed.

Do not expose catalogue/provider API keys to the browser.

## Persistent backend

### Recommended: Supabase

Use Supabase for:

- Postgres;
- anonymous authentication;
- optional permanent account upgrade;
- Row Level Security;
- Realtime Presence/Broadcast;
- scheduled cleanup/maintenance jobs.

Why this fits Reel Consensus:

- anonymous auth gives zero-email first use while still creating a real authenticated principal;
- RLS is a strong match for room/member access;
- Realtime is sufficient for 2–5-person rooms;
- relational Postgres is a natural fit for groups, sessions, decisions and history.

Keep the repository layer abstract enough that the domain engine does not depend on Supabase client types.

---

# Service boundaries

```text
browser
  │
  ├── Supabase Auth
  ├── Supabase Realtime
  │
  └── /api/*
       │
       ├── catalog/
       │    └── CatalogProvider
       │         └── TmdbCatalogProvider
       │
       ├── availability/
       │    └── AvailabilityProvider
       │         └── TmdbWatchProvider
       │
       ├── intent/
       │    └── OpenRouter + local fallback
       │
       └── decision/
            └── pure domain engine
```

No React component should know whether availability comes from TMDB, Watchmode or another provider.

---

# Catalogue provider contract

```ts
export type DiscoveryQuery = {
  region: string;
  providerIds: string[];
  monetization: ("flatrate" | "free" | "ads" | "rent" | "buy")[];
  maxRuntime: number | null;
  minRating: number | null;
  includeGenres: string[];
  excludeGenres: string[];
  language: string;
};

export interface CatalogProvider {
  discover(query: DiscoveryQuery): Promise<CatalogCandidate[]>;
  getMovie(id: string, locale: string): Promise<CatalogMovie>;
  getMovies(ids: string[], locale: string): Promise<CatalogMovie[]>;
}
```

Internal normalized models should use Reel Consensus IDs plus external IDs:

```ts
type ExternalId = {
  source: "tmdb";
  id: string;
};
```

Never use raw TMDB genre IDs inside the decision engine.

---

# TMDB request strategy

## Discovery

Use `discover/movie` with filters as early as possible:

- `watch_region`;
- `with_watch_providers`;
- `with_watch_monetization_types`;
- `with_runtime.lte`;
- `vote_average.gte`;
- `without_genres`;
- `include_adult=false`.

Provider IDs joined with `|` mean OR where supported; comma means AND.

Fetch a bounded number of pages, normally enough for 40–60 candidates.

## Enrichment

For only the strongest 20–30 candidates, call movie details with `append_to_response` for useful subresources such as:

- keywords;
- watch/providers;
- release dates if needed.

This reduces round-trips.

## Rate handling

TMDB documents a soft upper limit around 40 requests/second that may change.

Implementation requirements:

- global timeout;
- bounded concurrency;
- `429` backoff;
- request deduplication;
- cache;
- circuit breaker after repeated upstream failures.

Do not bulk scrape.

---

# Availability architecture

## Internal model

```ts
type Availability = {
  movieId: string;
  region: string;
  providerId: string;
  providerName: string;
  monetization: "flatrate" | "free" | "ads" | "rent" | "buy";
  source: "tmdb-justwatch";
  sourceUrl: string | null;
  fetchedAt: string;
};
```

## Attribution

When provider data is visible, include JustWatch attribution as required by the source terms.

TMDB attribution should exist in About/Credits using approved TMDB branding and notice.

## Deep links

TMDB watch-provider responses are not a deep-link service.

V1 behavior:

- show “Available on Netflix / Prime / …”;
- provide the returned TMDB destination where appropriate;
- avoid inventing provider-specific deep links.

A future commercial provider adapter can add direct deep links.

---

# Cache strategy

Caching should reduce latency and upstream dependency while avoiding a massive shadow catalogue.

Recommended TTLs:

| Data | TTL |
| --- | ---: |
| Provider list per region | 7 days |
| Static-ish movie details | 3–7 days |
| Keywords | 7 days |
| Availability | 6–24 hours |
| Discovery result | 15–60 min |
| AI mood enrichment | long-lived until metadata changes |

Store only data the product actively uses.

## Stale-while-revalidate

For returning groups:

1. return a still-acceptable cached result;
2. refresh in background within the request lifecycle / scheduled job;
3. update the next request.

Never block a movie-night decision on a noncritical metadata refresh.

---

# Data model

## users

Supabase Auth owns identity.

Application profile table:

```text
profiles
- id uuid PK -> auth.users.id
- display_name
- created_at
- upgraded_at nullable
```

No email duplicated into application tables unless needed.

## groups

```text
groups
- id uuid PK
- name nullable
- created_by uuid
- default_region char(2)
- fairness_memory_enabled boolean
- created_at
- updated_at
```

## group_members

```text
group_members
- group_id
- user_id
- display_name
- role host|member
- joined_at
- left_at nullable
```

Unique active membership per group/user.

## group_provider_preferences

```text
- group_id
- region
- provider_id
- monetization_types[]
```

Playback context belongs to the group/room, not individual taste.

## taste_profiles

```text
- user_id
- feature_key
- feature_type
- weight
- confidence
- evidence_count
- updated_at
```

Examples:

- `genre:sci-fi`;
- `mood:funny`;
- `keyword:time-travel`;
- `runtime:long-tolerance`.

Hard vetoes should be represented separately as explicit user rules, not inferred from negative weights.

## rooms

```text
rooms
- id uuid PK
- group_id nullable
- host_user_id
- state setup|ready|deciding|decided|closed
- region
- max_runtime
- min_rating
- fairness_mode
- invite_token_hash
- invite_expires_at
- created_at
- expires_at
```

## room_participants

```text
- room_id
- user_id
- display_name_snapshot
- ready
- joined_at
- last_seen_at
```

## room_preferences

Tonight-only state:

```text
- room_id
- user_id
- liked_genres[]
- avoided_genres[]
- moods[]
- free_text_summary nullable
- updated_at
```

Do not write these values into durable taste automatically.

## decisions

```text
decisions
- id
- room_id
- movie_id
- engine_version
- group_score
- selected_at nullable
- confirmed_watched_at nullable
- created_at
```

## decision_participant_scores

```text
- decision_id
- user_id
- score
- matched_features jsonb
```

Persist the score snapshot so future fairness updates are auditable even if the engine changes.

## candidate_events

```text
- room_id
- user_id nullable
- movie_id
- event_type
- reason nullable
- created_at
```

Examples:

- shown;
- shortlisted;
- dismissed_not_tonight;
- already_watched;
- unavailable;
- selected.

## post_watch_feedback

```text
- decision_id
- user_id
- reaction loved|fine|not_for_me
- reason nullable
- created_at
```

## fairness_ledger

```text
- group_id
- user_id
- balance
- confidence
- sample_count
- updated_at
```

No public “debt score” UI.

---

# Anonymous room lifecycle

## 1. First visit

```ts
await supabase.auth.signInAnonymously();
```

The user gets an authenticated identity without PII.

## 2. Host creates room

Server:

- creates room;
- creates host membership;
- creates 128-bit random invite token;
- stores only a token hash;
- returns invite URL.

## 3. Guest joins

Invite URL contains opaque token.

Server:

- verifies hash;
- checks expiry/revocation;
- creates room membership;
- never exposes privileged database keys.

## 4. Realtime

Private room channel:

```text
room:<uuid>
```

Presence payload only contains safe transient values:

- user ID;
- display name;
- ready flag.

Preferences remain in protected database rows.

## 5. Expiry

Temporary rooms expire after a defined period.

Scheduled cleanup:

- closes expired rooms;
- removes stale invite tokens;
- deletes disposable room preferences according to retention policy;
- preserves aggregated product metrics separately.

---

# Row Level Security model

Principle:

> A user can read/write room data only if an active membership exists.

Examples:

- rooms SELECT: active member;
- room_preferences SELECT: active member;
- own room_preferences UPDATE: own user ID only;
- room host can remove members;
- decisions SELECT: active member;
- group history SELECT: active saved-group member.

Realtime authorization should mirror membership rules.

Never trust room ID secrecy as authorization.

---

# Taste learning pipeline

```text
explicit feedback / confirmed behavior
       ↓
event classification
       ↓
durable vs contextual decision
       ↓
feature evidence
       ↓
weight + confidence update
       ↓
next-room participant scoring
```

The updater should be a pure/testable function.

Example event strengths, subject to tuning:

```text
loved                +1.00
fine                 +0.20
not_for_me           -0.80
shortlisted          +0.15
not_tonight           0.00 durable
already_watched       0.00
unavailable           0.00
```

Do not turn one inferred negative into a hard veto.

---

# Fairness memory algorithm

## Historical concession signal

For each confirmed watched decision:

```ts
const concession =
  clamp((groupMeanScore - participantScore) / 25, -1, 1);
```

Positive value means the participant accepted a lower-fit outcome than the group mean.

## Decayed ledger

Concept:

```ts
balance = decay * oldBalance + concession;
```

Suggested starting decay:

```text
0.75–0.85 per completed movie night
```

This deliberately forgets old imbalance.

## Weight conversion

After at least 3 samples:

```ts
participantWeight =
  clamp(1 + fairnessStrength * normalizedBalance, 0.85, 1.15);
```

Normalize active participant weights so the average remains 1.

## Score cap

History may alter final ranking by at most ~5 group-score points initially.

This prevents “fairness debt” from producing obviously bad recommendations.

## Hard invariants

Historical fairness:

- runs after hard constraints;
- cannot change a veto;
- cannot make unavailable content eligible;
- cannot override tonight’s explicit maximum runtime;
- must be explainable;
- must be versioned.

---

# Decision engine versioning

Persist:

```text
engine_version = "2.0.0"
```

Every decision snapshot should know which algorithm produced it.

If scoring coefficients change:

- old historical score snapshots stay immutable;
- fairness ledger migration is explicit;
- A/B tests record engine version.

---

# Failure and fallback architecture

## TMDB down

If recent cached candidates exist:

- serve cache;
- label availability freshness only if materially stale.

If no cache:

- show a clear temporary catalogue failure;
- do not fall back to the 20-demo catalogue in a real saved group without telling users.

## OpenRouter down

Existing behavior remains:

- local parser fallback;
- ranking still works.

## Supabase realtime down

Persisted room writes continue where possible.

Client can:

- poll room state every few seconds;
- show degraded realtime status.

## Supabase database down

Do not pretend the group is synchronized.

Offer:

- local single-device fallback only if explicitly labelled;
- retry.

## Provider availability missing

Do not treat “unknown” as “available”.

Unknown content can optionally appear in a separate “availability unknown” section, never as the default winner.

---

# Privacy and retention

Principles:

- collect no PII before it is needed;
- anonymous identity by default;
- free-text briefs are operational data, not analytics payloads;
- no public preference metadata in share cards;
- allow group/history deletion;
- document retention;
- avoid storing precise location;
- store country only for availability;
- separate analytics from taste content.

Before public EU launch, create a real privacy policy and review GDPR obligations.

---

# Cost controls

The architecture is designed to be cheap at early scale.

Key controls:

- bounded TMDB candidate pages;
- details only for top candidates;
- aggressive dedupe/cache;
- no per-candidate LLM call;
- anonymous auth rather than custom session infrastructure;
- tiny Realtime rooms;
- TTL cleanup of temporary rooms;
- no full-catalog ingestion.

Supabase’s free plan is sufficient for early validation but production limits must be monitored.

---

# Migration from current MVP

## Preserve

- domain types concept;
- hard-veto semantics;
- fairness modes;
- deterministic ranking;
- AI/local intent boundary;
- React/Vite UI.

## Replace

```text
src/data/movies.ts
```

with:

```text
catalog adapter + normalized candidate loader
```

## Extend

```ts
Movie
```

into a normalized production model:

```ts
type Movie = {
  id: string;
  externalIds: ExternalId[];
  title: string;
  year: number;
  runtime: number;
  rating: number;
  voteCount: number;
  genres: Genre[];
  moods: MoodEvidence[];
  summary: string;
  posterUrl: string | null;
  availability: Availability[];
};
```

Keep presentation-only fields such as `glyph` out of the core domain model.

---

# Architecture decision summary

The optimal first production architecture is:

- React/Vite stays;
- Supabase provides anonymous identity, persistence, RLS and realtime;
- Vercel Functions remain the BFF;
- TMDB is the initial non-commercial catalogue/availability source;
- all external providers sit behind adapters;
- decision engine remains deterministic;
- history is evidence-based;
- fairness memory is small, capped and explainable.

This gives the product enough infrastructure to validate real product-market fit without prematurely building a large platform.
