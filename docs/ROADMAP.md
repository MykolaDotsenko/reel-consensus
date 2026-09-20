# Product Roadmap to a Real Decision Product

_Last reviewed: 2026-09-21_

This roadmap is ordered by **risk reduction and product leverage**, not by visual excitement.

---

# Phase 0 — Measurement and production contracts

## Objective

Know whether future work improves the product.

## Deliverables

- product event schema;
- successful-movie-night definition;
- engine version included in decision events;
- privacy-safe analytics wrapper;
- `CatalogProvider` and `AvailabilityProvider` interfaces;
- feature flags for catalogue, rooms, history and fairness memory.

## Acceptance criteria

- current demo decision flow still works;
- every important funnel event can be measured;
- no raw free-text brief is sent to analytics;
- domain engine has no vendor imports.

## Exit metric

Baseline data exists before feature experiments begin.

---

# Phase 1 — Anonymous shareable rooms

## Why first

It validates the strongest distribution hypothesis without waiting for the full catalogue migration.

## Deliverables

### Backend

- Supabase project;
- anonymous auth;
- room/member schema;
- RLS;
- private Realtime channels;
- room expiry;
- invite-token exchange.

### Product

- Create room;
- Share link;
- QR code;
- guest name;
- live participant stack;
- ready state;
- current demo preferences sync between devices;
- reconnect after refresh.

## UX target

Guest joins and becomes ready in **< 30 seconds**.

## Critical scenarios

Test:

- 2 people;
- 5 people;
- host disconnect/reconnect;
- guest refresh;
- duplicate invite open;
- revoked invite;
- expired invite;
- participant removed;
- one slow participant;
- mobile → desktop mixed room.

## Exit metrics

- invite → join > 70%;
- room sync reliability > 99% in test scenarios;
- no mandatory email.

---

# Phase 2 — Real catalogue + availability

## Objective

Turn the product from a demo into something a group can trust tonight.

## Deliverables

- TMDB adapter;
- server-side secrets;
- discover-based candidate funnel;
- normalized movie domain model;
- poster/backdrop support;
- keyword enrichment;
- deterministic mood mapping;
- provider/country selector;
- group playback context;
- JustWatch/TMDB attribution;
- availability cache;
- mismatch reporting;
- no-result diagnostics.

## Default market behavior

Start with movies only.

Do not add TV shows in this phase.

Default:

- current country suggestion;
- subscription/free/ads;
- selected providers;
- rent/buy off.

## Exit metrics

- p50 candidate response < 2 s from warm cache;
- p95 < 5 s;
- availability mismatch reports < 3%;
- > 90% of successful decisions come from real catalogue;
- zero hard-veto violations in automated tests.

---

# Phase 3 — Saved groups and repeat experience

## Objective

Make the second movie night much faster than the first.

## Deliverables

- “Save this group” prompt after first completed decision;
- anonymous → permanent account linking;
- magic-link recovery;
- saved group list;
- saved provider context;
- previous watches;
- remembered explicit hard preferences;
- group re-open in one tap.

## Returning flow

```text
Open Reel Consensus
  → choose “Us”
  → tonight’s mood
  → decide
```

Provider setup and basic individual taste should already exist.

## Exit metrics

- returning-group median setup < 30 s;
- 30-day returning-group rate > 25%;
- > 30% of completed first-time rooms save the group.

---

# Phase 4 — Taste memory

## Objective

Recommendations improve from completed usage instead of forcing long onboarding.

## Deliverables

- feature-evidence model;
- post-watch feedback;
- semantic dismiss reasons;
- taste confidence;
- “not tonight” excluded from durable negatives;
- already-watched handling;
- rewatch toggle;
- taste reset/edit UI;
- versioned learner.

## Feedback UX

One-tap:

- Loved it;
- Fine;
- Not for me.

Optional reason only after negative feedback.

## Exit metrics

- feedback completion > 20%;
- returning groups dismiss fewer candidates over time;
- no detectable degradation from accidental “not tonight” learning.

---

# Phase 5 — Long-term fairness memory

## Objective

Create the unique Reel Consensus moat.

## Deliverables

- concession ledger;
- 3-watch activation threshold;
- decay;
- ±10–15% participant weight cap;
- ±5 group-score impact cap;
- history explanation;
- off/reset control;
- group-composition-safe behavior;
- fairness regression suite.

## Required invariant tests

Historical memory must never:

- bypass hard veto;
- bypass provider availability;
- bypass runtime;
- make one participant dominate;
- activate with < 3 confirmed watches;
- change outcome after reset.

## Experiment

A/B:

- engine V2 without memory;
- engine V2 with capped memory.

Measure:

- time to decision;
- dismiss count;
- selection confidence;
- post-watch satisfaction;
- return rate.

Do not ship a stronger historical adjustment until data supports it.

---

# Phase 6 — Distribution and retention optimization

Only after Phases 1–5 work.

## Distribution

- high-quality Open Graph invite card;
- native share sheet;
- QR;
- “start another room” after success;
- lightweight public marketing pages around use cases;
- referral attribution that does not expose taste data.

## Retention

- opt-in movie-night reminder;
- “your group is ready” notifications only with consent;
- recent group shortcut;
- last-watch feedback prompt;
- “new on your services” only if catalogue/provider licensing permits.

Avoid notification spam.

---

# Phase 7 — Commercial validation

Do not start with pricing screens.

## Before monetization

Validate:

- recurring group cohort;
- strong decision completion;
- stable availability source;
- commercial data rights;
- meaningful repeat usage.

## Then test willingness to pay

Potential premium dimensions:

- more saved groups;
- deeper history;
- family profiles;
- richer provider integrations;
- advanced filters;
- TV support.

Keep core room decision free.

---

# Priority matrix

| Work | User value | Retention | Virality | Differentiation | Complexity | Priority |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| Anonymous rooms | 9 | 7 | 10 | 6 | 7 | **P0** |
| Real catalogue | 10 | 8 | 4 | 4 | 7 | **P0** |
| Country/provider availability | 10 | 8 | 5 | 5 | 7 | **P0** |
| Saved groups | 8 | 10 | 5 | 5 | 6 | **P0** |
| Taste history | 8 | 10 | 4 | 7 | 7 | **P1** |
| Long-term fairness | 8 | 9 | 5 | 10 | 8 | **P1** |
| Pairwise Battle Mode | 6 | 5 | 6 | 6 | 5 | P2 |
| TV shows | 7 | 6 | 3 | 2 | 7 | P2 |
| Native apps | 4 | 5 | 3 | 1 | 9 | P3 |
| Social feed/chat | 2 | 3 | 4 | 1 | 8 | **Do not build** |

---

# Suggested implementation sequence

## Sprint A — backend skeleton

- Supabase schema;
- anonymous auth;
- RLS;
- room repository;
- Realtime room prototype;
- analytics events.

## Sprint B — share loop

- create/join;
- QR/share;
- readiness;
- reconnect;
- room E2E across two browser contexts.

## Sprint C — catalogue boundary

- interfaces;
- TMDB server adapter;
- normalization;
- cache;
- error handling.

## Sprint D — availability

- provider selector;
- region;
- hard availability filter;
- no-results diagnostics;
- attribution.

## Sprint E — save group

- upgrade identity;
- persistent group;
- provider/taste defaults.

## Sprint F — history

- candidate events;
- watched confirmation;
- post-watch feedback;
- taste updater.

## Sprint G — fairness memory

- ledger;
- algorithm;
- explanations;
- A/B flag.

---

# Release gates

No phase is “done” only because code exists.

Each phase requires:

- unit tests;
- integration tests;
- desktop/mobile E2E;
- unhappy-path tests;
- privacy/security review for new data;
- production telemetry;
- rollback/feature flag.

---

# Kill / rethink signals

Pause and reconsider the product thesis if, after enough real traffic:

- invite → join remains < 40% despite low friction;
- most users prefer solo mode;
- decision completion remains < 30%;
- returning-group rate remains < 10%;
- availability mismatch destroys trust;
- history does not reduce decision time/dismissals;
- fairness memory lowers satisfaction.

A polished implementation is not evidence of product-market fit.

---

# Definition of “ready for serious launch”

Reel Consensus is ready for serious acquisition only when:

- real catalogue works;
- availability is region-aware;
- two people can join with no registration;
- a returning group reopens in < 30 seconds;
- history survives device/session changes for saved users;
- hard constraints are always respected;
- fairness memory is explainable and reversible;
- successful-movie-night metrics are tracked.

Until then, focus on product loop quality rather than marketing scale.
