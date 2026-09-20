# Product Success Blueprint

_Last reviewed: 2026-09-21_

## Goal

Reel Consensus should not become another generic movie recommender. The product should own one narrow job:

> **Help 2–5 people reach one fair, watchable movie decision quickly.**

The five capabilities below are the minimum product system that can materially change the odds of niche success:

1. real catalogue;
2. streaming availability by country;
3. instant shareable rooms with no mandatory registration;
4. persistent individual + group taste/history;
5. long-term fairness / compromise memory.

The five are interdependent. Catalogue and availability create utility. Rooms create distribution. History creates retention. Fairness memory creates differentiation and a data moat.

---

## What “niche success” means

The probability numbers in this document are planning estimates, not forecasts.

For this project, **niche product success** means reaching a stable product loop roughly in this range:

- 5,000–20,000 monthly active users;
- recurring groups/couples, not only one-off visitors;
- organic invitations contribute a meaningful share of new users;
- the product consistently gets groups from “what should we watch?” to one accepted option;
- retention is strong enough that the same group returns for future movie nights.

A larger breakout is possible, but this blueprint optimizes first for a durable niche product.

### Current planning estimate

- Current polished MVP, if simply deployed: roughly **32%** chance of becoming a useful niche product with serious iteration and distribution.
- Five capabilities implemented well: roughly **50–55%**.
- Five capabilities + strong instrumentation + invite loop + retention loop + disciplined go-to-market: **55–60%** is a reasonable internal target scenario.

Do not treat the percentages as additive or statistically calibrated. Their value is comparative: they force us to ask which work changes product risk rather than only UI quality.

---

## North-star metric

### Successful Movie Nights

A **Successful Movie Night** is a room where:

1. at least 2 participants are active;
2. the group produces ranked candidates;
3. one candidate is explicitly marked **Watch this**;
4. the decision occurs within a bounded session, ideally within 10 minutes of everyone being ready.

This is stronger than page views, searches, swipes or AI calls. It measures the product job.

### Primary supporting metrics

| Metric | Why it matters | Initial target |
| --- | --- | ---: |
| Median time from room creation to decision | Core value is reducing negotiation | < 2 min for returning groups; < 4 min new groups |
| Invite → join conversion | Measures friction in the viral loop | > 70% |
| Rooms with 2+ active participants | Confirms multi-person usage | > 60% of created rooms |
| Decision completion rate | Measures whether ranking actually resolves the problem | > 60% |
| 30-day returning-group rate | Best early retention signal | > 25% |
| “Watch this” → post-watch feedback | Determines how quickly taste memory improves | > 20% |
| Decisions requiring > 5 candidate dismissals | Detects poor ranking quality | < 20% |
| Availability mismatch reports | Trust signal for provider data | < 3% of completed decisions |

These are product targets, not market benchmarks. Adjust after real traffic.

---

# Target customer and use cases

## Primary segment: recurring couples

This should be the first optimization target.

Why:

- repeat frequency is higher than ad-hoc friend groups;
- shared streaming subscriptions are easier to model;
- persistent taste and fairness memory become useful quickly;
- invite friction can disappear after the group is saved.

Primary promise:

> “We like different things. Give us something both of us can genuinely agree to.”

## Secondary segment: households and close friend groups

3–5 people, usually in the same room.

Important differences:

- consensus is harder;
- fairness modes become more valuable;
- group membership changes more often;
- streaming availability still belongs to the shared playback context, not to each participant.

## Later segment: remote watch parties

Do **not** optimize V1 for remote viewing.

Remote groups introduce extra ambiguity:

- availability may differ by country;
- each participant may have different subscriptions;
- synchronised playback becomes a separate product problem.

Architecture should not block this future, but the first production model should assume a **shared physical playback context**.

---

# Capability 1 — Real catalogue

## Product objective

Replace the 20-item demo catalogue with a broad current catalogue without turning the system into an unbounded search product.

The decision engine should still operate on a **small, high-quality candidate pool**, not score the whole internet.

## Recommended source

### MVP: TMDB behind a server-side provider boundary

Use TMDB for:

- movie discovery;
- metadata;
- genre IDs;
- runtime;
- vote average / vote count;
- overview;
- poster/backdrop assets;
- keywords;
- watch-provider discovery.

Keep all TMDB credentials server-side.

Important external constraints:

- TMDB developer API is free for non-commercial use with attribution.
- Commercial use requires a commercial arrangement.
- Watch-provider data is supplied through TMDB’s JustWatch partnership and requires JustWatch attribution.
- Provider data gives availability categories per country but not full provider deep links.

Therefore the code must depend on an internal interface such as:

```ts
interface CatalogProvider {
  discover(query: DiscoveryQuery): Promise<MovieCandidate[]>;
  details(ids: string[], locale: string): Promise<MovieDetails[]>;
  availability(ids: string[], region: string): Promise<Availability[]>;
}
```

Never let the decision engine import TMDB-specific response types.

## Candidate funnel

Do not ingest the full catalogue for every request.

Recommended flow:

```text
room constraints
      ↓
TMDB discover
  40–60 candidates
      ↓
hard availability/runtime/rating filtering
      ↓
enrich 20–30 candidates
  details + keywords + watch providers
      ↓
normalize to Reel Consensus features
      ↓
deterministic group scoring
      ↓
top 10 ranked
      ↓
show top 3
```

Use TMDB `discover/movie` filters early:

- `watch_region`;
- `with_watch_providers`;
- `with_watch_monetization_types`;
- runtime;
- minimum vote average;
- genres;
- adult content off by default.

This reduces API traffic and makes the candidate set relevant before expensive enrichment.

## Mood model

TMDB does not supply Reel Consensus moods directly.

Do **not** call an LLM for every candidate in every room.

Recommended hierarchy:

1. deterministic mapping from genres + keywords + runtime + metadata;
2. cached enrichment for uncertain titles;
3. optional offline/async LLM classification only when confidence is low;
4. never let LLM-generated mood tags override hard factual constraints.

Store mood provenance and confidence:

```ts
type MoodEvidence = {
  mood: Mood;
  confidence: number;
  source: "rule" | "keyword" | "ai-enrichment";
};
```

## Catalogue quality controls

Exclude or down-rank:

- titles with extremely low vote counts;
- missing runtime;
- missing availability for the selected playback context;
- duplicates / alternate releases;
- unavailable adult content;
- titles already watched by the group unless “rewatch” is enabled.

Add a minimum confidence gate before a movie can become the #1 recommendation.

---

# Capability 2 — Streaming availability by country

## Product objective

The winning recommendation must be something the room can actually watch.

Availability should be a **hard pre-ranking constraint**, not a decorative badge added after ranking.

## Playback context

Create a single room-level concept:

```ts
type PlaybackContext = {
  countryCode: string;
  providerIds: string[];
  allowedMonetization: ("subscription" | "free" | "ads" | "rent" | "buy")[];
};
```

For same-room movie nights, the room’s TV/subscriptions matter more than each participant’s personal subscriptions.

### Default behavior

- infer a suggested country from browser locale only;
- always show the country and make it editable;
- never depend on precise location;
- persist country + services for a saved group;
- default monetization to subscription/free/ads;
- rent/buy is an explicit opt-in.

## Provider filtering

Availability rules happen before preference scoring:

```text
country
  → provider availability
  → monetization type
  → runtime/rating/vetoes
  → participant scoring
```

Never show a movie as the “best compromise” and then reveal that nobody can stream it.

## No-result recovery

Do not silently relax rules.

When no candidate survives, diagnose the bottleneck and offer explicit choices:

1. include rent/buy;
2. add another streaming service;
3. relax runtime;
4. relax minimum rating;
5. remove a group-wide genre exclusion.

Never relax a participant hard veto automatically.

## Data freshness

Recommended cache policy:

- provider list by country: 7 days;
- movie metadata: 3–7 days;
- availability: 6–24 hours;
- candidate discovery responses: 15–60 minutes;
- use stale-while-revalidate where possible.

Availability can be wrong. Include:

> “Availability data can change. Report mismatch.”

A mismatch report should be stored as a product-quality event and can trigger early refresh.

## Commercial path

MVP:
- TMDB + JustWatch attribution.

Before monetization:
- obtain appropriate commercial licensing, or;
- swap the provider adapter to a commercial availability source.

Potential alternatives include commercial Watchmode or a direct JustWatch content partnership. Do not build around unofficial JustWatch scraping.

---

# Capability 3 — Instant shareable rooms without mandatory registration

## Product objective

The invitation itself should be the main acquisition mechanism.

Ideal flow:

```text
Create movie night
      ↓
share link / QR
      ↓
friend opens link
      ↓
choose name + 20–30 sec preferences
      ↓
ready
      ↓
group sees live state
      ↓
decide
```

No email, password or app install before value.

## Recommended identity model

Use **anonymous authenticated users**, not unrestricted public room writes.

Recommended backend: Supabase because it provides:

- anonymous auth;
- Postgres;
- Row Level Security;
- Realtime Broadcast;
- Realtime Presence;
- a straightforward upgrade path from anonymous to permanent identity.

### Room security model

Do not put an admin/write credential in the invite URL.

Recommended design:

- room has a UUID;
- invitation contains a random high-entropy join token;
- database stores a hash of the token;
- joining exchanges the token for room membership;
- after membership is created, RLS controls all reads/writes;
- host can rotate or revoke the invite;
- optional short human code can exist later with rate limiting.

## Realtime responsibilities

Use:

- **Presence** for “Alex is here / ready”;
- **Broadcast** for transient UI events;
- persisted database rows for preferences, room state and decisions.

Do not rely on ephemeral realtime messages as the source of truth.

## Room lifecycle

### Temporary room

Default for first-time users.

- no account required;
- expires after 7–30 days;
- anonymous IDs persist only on that browser/device;
- invite can be revoked.

### Saved group

Offer only **after the first completed decision**:

> “Save this group for next movie night?”

Upgrade path:

- email magic link or other low-friction permanent identity;
- existing anonymous profile is linked rather than recreated;
- historical group/taste data remains.

This is progressive identity: prove value first, ask for account recovery second.

## Important edge cases

Handle explicitly:

- host closes browser;
- participant refreshes;
- participant opens room on a second device;
- invite link leaks;
- duplicate participant names;
- host removes a participant;
- room reaches 5-member limit;
- one participant never marks ready;
- group decides before everyone joins;
- participant disconnects during ranking;
- room expires;
- anonymous user clears browser storage.

The decision must remain recoverable from server state.

---

# Capability 4 — Persistent group taste and history

## Product objective

A returning group should need less configuration and receive better recommendations than a new group.

The system should remember **evidence**, not manufacture a mysterious black-box “taste score”.

## Separate three layers

### 1. Durable individual taste

Long-term signals such as:

- genres consistently loved;
- disliked genres;
- explicit hard vetoes;
- preferred intensity;
- language preferences;
- tolerance for long runtime;
- recurring keyword/theme preferences.

### 2. Group history

Facts such as:

- movies watched together;
- shortlisted movies;
- repeated dismissals;
- accepted compromises;
- post-watch reactions;
- provider/playback context.

### 3. Tonight context

Ephemeral signals:

- “something funny tonight”;
- “not too heavy”;
- “under 90 minutes”;
- current mood;
- temporary guest preferences.

Tonight context should **not** automatically become durable taste.

## Event semantics

Not all interactions mean the same thing.

| Event | Durable taste effect |
| --- | --- |
| Watched + loved | strong positive |
| Watched + okay | weak positive / neutral |
| Watched + not for me | meaningful negative |
| Explicit “I dislike this genre/theme” | strong negative |
| Shortlisted | weak positive |
| “Not tonight” | **no durable negative** |
| Already watched | no preference signal |
| Unavailable | no preference signal |
| Too long tonight | context only |
| Group veto | hard current-session constraint unless explicitly made durable |

This prevents the recommendation model from learning false dislikes.

## Post-watch feedback

Keep it lightweight.

After a completed movie night, next visit can ask each returning member one question:

> How was last night’s pick?

- Loved it
- Fine
- Not for me

Do not start with 5-star ratings.

Optional second question only when useful:

> What was the issue?

- too slow;
- too intense;
- not my genre;
- too long;
- other.

## Cold start

For new users:

- 3–5 quick preference chips;
- current mood;
- optional 3 pairwise choices only if the room needs more signal.

Do not force a long taste onboarding.

## Preference confidence

Every learned feature should have:

- weight;
- confidence;
- evidence count;
- last-updated timestamp.

Low-confidence inferred taste must never become a hard veto.

---

# Capability 5 — Long-term fairness / compromise memory

## Product objective

Reel Consensus should remember not only **what the group likes**, but **who has been compromising recently**.

This is the strongest defensible product idea in the roadmap.

## Core rule

Historical fairness is a **small transparent adjustment**, never a hidden override.

It must never:

- bypass a hard veto;
- force a low-fit movie;
- overwhelm tonight’s explicit mood;
- permanently punish someone for one movie;
- create a score that users cannot explain.

## When fairness memory activates

Only after:

- at least 3 confirmed shared watches for the relevant group;
- enough confidence exists in participant scoring.

Before that, history weight is zero.

## Compromise ledger

After a movie is confirmed as watched, compute a per-person concession signal.

Conceptually:

```text
concession = group mean fit - participant fit
```

A person who repeatedly accepts lower-fit winners accumulates a positive “owed consideration” balance.

Recommended implementation:

- update only after confirmed watch;
- exponential decay so old compromises matter less;
- cap balance;
- normalize among the participants currently present;
- cap final historical weight shift to roughly ±10–15%;
- cap total score impact to roughly ±5 points.

Exact coefficients should be tuned through tests and product data, not treated as permanent constants.

## Group composition

Track fairness at member level.

If a new person joins:

- new participant starts neutral;
- existing members keep their personal ledger;
- only balances for currently participating members affect the room.

If a participant is absent, their balance does not affect that session.

## User-facing explanation

When history materially changes ordering, say so:

> “This option slightly favors Maya because the last few group picks leaned away from her taste.”

Allow:

- turn fairness memory off;
- reset fairness history;
- inspect recent contribution in plain language.

Do **not** expose a guilt-inducing scoreboard such as “You owe Alex 2 movies.”

---

# Product architecture that ties the five capabilities together

```text
React/Vite client
      │
      ├── Supabase Auth
      │     anonymous → optional permanent identity
      │
      ├── Supabase Realtime
      │     room presence + transient collaboration
      │
      └── Vercel API/BFF
             │
             ├── TMDB catalog adapter
             ├── availability adapter
             ├── OpenRouter intent parser
             └── decision orchestration
                    │
                    ▼
             Supabase Postgres
               rooms
               memberships
               preferences
               histories
               decisions
               fairness ledger
               cache metadata
```

The deterministic decision engine remains a pure domain layer.

External services supply facts and structured context; they do not decide the winner.

---

# Distribution loop

The highest-ROI acquisition loop is built into the product:

```text
Person A creates room
      ↓
invites B / C
      ↓
B / C experience value without signup
      ↓
group reaches decision
      ↓
save group
      ↓
next movie night returns same members
      ↓
one member creates a different room with other people
```

Every successful room can create users.

## Sharing surfaces

Ship:

- system share sheet;
- copy link;
- QR code;
- WhatsApp / Messenger-friendly preview;
- compact Open Graph card:
  - Reel Consensus mark;
  - “Join our movie night”;
  - participant count;
  - no private taste details.

Never expose preferences in public OG metadata.

---

# Retention loop

A saved group should improve over time:

```text
return
  ↓
same people already loaded
  ↓
same country/providers already loaded
  ↓
brief tonight’s mood
  ↓
better ranking from history
  ↓
watch
  ↓
one-tap feedback
  ↓
stronger taste + fairness model
```

The repeat experience should be dramatically faster than first use.

Target returning-group flow:

> open app → choose saved group → “what mood tonight?” → decide

No repeated provider setup or taste onboarding.

---

# Monetization strategy

Do not monetize before retention proves the core loop.

## Free core

Keep the decision itself free:

- create room;
- invite group;
- core catalogue;
- standard fairness;
- basic history.

Putting consensus behind a paywall would damage the invite loop.

## Potential paid value later

Only after meaningful recurring usage:

- multiple saved groups;
- deeper history insights;
- advanced fairness controls;
- family profiles;
- richer filters;
- premium provider integrations;
- TV-series support;
- export / shared lists.

## Licensing gate

Before commercial launch, explicitly resolve:

- TMDB commercial license;
- watch-provider commercial rights;
- image/data attribution;
- any affiliate/deep-link agreements.

Do not turn on paid plans first and investigate data licensing later.

---

# Analytics and experiments

Instrument product events before scaling traffic.

Minimum events:

- `room_created`
- `invite_shared`
- `invite_joined`
- `participant_ready`
- `decision_requested`
- `candidate_shown`
- `candidate_dismissed`
- `candidate_selected`
- `watch_confirmed`
- `post_watch_feedback`
- `group_saved`
- `group_returned`
- `availability_mismatch_reported`

Never send raw free-text briefs or private preference data to analytics by default.

## High-value experiments

1. **Room first vs taste first**
   - Does sharing before full setup increase join rate?

2. **3 results vs 1 result**
   - Does a single strong recommendation reduce time-to-decision, or reduce trust?

3. **Explicit fairness mode vs automatic balanced**
   - Does asking users to choose a mode help or add friction?

4. **Post-watch feedback timing**
   - Immediately after selection vs next visit.

5. **Save-group prompt timing**
   - After first decision vs after second visit.

6. **Historical fairness explanation**
   - Always visible vs only when ranking changes materially.

---

# Failure modes and mitigation

## “The catalogue is large but recommendations feel generic”

Mitigation:

- better candidate retrieval;
- keyword/mood enrichment;
- stronger participant-level score calibration;
- measure dismiss reason.

## “Users create rooms but friends do not join”

Mitigation:

- no account;
- fast join;
- better share preview;
- QR;
- editable display name after join;
- fewer onboarding questions.

## “People use it once but never return”

Mitigation:

- saved group;
- provider persistence;
- history;
- post-watch feedback;
- returning flow under 30 seconds.

## “Availability is wrong”

Mitigation:

- cache freshness;
- visible provider source attribution;
- mismatch report;
- explicit country/provider context;
- commercial provider upgrade when justified.

## “Fairness memory feels manipulative”

Mitigation:

- activate after enough history;
- small capped effect;
- plain-language explanation;
- off/reset control;
- never bypass veto.

## “History learns bad signals”

Mitigation:

- semantic dismiss reasons;
- ‘not tonight’ is context only;
- feedback confidence;
- undo/reset taste profile.

## “Anonymous user loses identity”

Mitigation:

- progressive “Save this group”;
- magic-link upgrade after value;
- do not require signup before first decision.

---

# What not to build yet

Avoid these until the core loop is validated:

- native iOS/Android apps;
- social feed;
- chat;
- streaming playback;
- full TV-series support;
- AI-generated final recommendations;
- global catalogue ingestion;
- vector database as the primary recommender;
- long onboarding quiz;
- complex star ratings;
- subscription paywall;
- gamification that makes fairness feel competitive;
- remote-watch synchronization.

Each adds surface area without proving the core job.

---

# Decision summary

If only five major investments are allowed, choose:

1. **Anonymous realtime rooms** — unlocks collaboration and organic distribution.
2. **Real catalogue + country/provider filtering** — turns demo into utility.
3. **Saved groups + lightweight history** — creates return value.
4. **Semantically correct taste learning** — makes history trustworthy.
5. **Capped explainable fairness memory** — creates differentiation and moat.

The product should become more useful with every completed movie night while remaining faster than opening five streaming apps and arguing.
