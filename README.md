# Reel Consensus

**Stop scrolling. Agree on something worth watching.**

Reel Consensus is a group movie decision engine. Instead of recommending what one person might like, it tries to find the fairest compromise for everyone in the room — with visible participant scores, hard vetoes, configurable fairness, and explanations for every result.

## Product thesis

Movie night is rarely an information problem. People already have too many options. The hard part is reaching a decision when tastes, moods, time limits, and hard dislikes conflict.

Reel Consensus models that problem explicitly:

```text
people + preferences + vetoes + shared brief
                    ↓
            hard constraints
                    ↓
        per-person fit scoring
                    ↓
           fairness strategy
                    ↓
        ranked group compromises
                    ↓
       reasons + visible trade-offs
```

## Current MVP

- 1–5 participants with independent genre preferences, moods, and hard vetoes.
- Shared natural-language movie-night brief.
- Optional OpenRouter AI intent parsing.
- Deterministic local parser when AI is unavailable.
- Hard runtime, rating, and group-wide genre constraints.
- Three fairness modes:
  - **Balanced** — rewards fit while penalizing disagreement.
  - **No one hates it** — strongly protects the least-satisfied participant.
  - **Democratic** — prioritizes the group average.
- Explainable top recommendations with:
  - group-fit score;
  - per-person fit scores;
  - reasons;
  - visible trade-offs.
- “Not tonight” reranking.
- “Surprise us” from the current high-fit pool.
- Responsive desktop/mobile UI.
- Unit, interaction, and Playwright coverage.

## Why AI is not the decision engine

AI has one narrow job: translate fuzzy human language into structured signals such as:

```json
{
  "likedGenres": ["mystery", "comedy"],
  "avoidedGenres": ["horror"],
  "moods": ["funny", "thoughtful"],
  "maxRuntime": 120,
  "minRating": 7.5
}
```

The actual ranking is deterministic and testable. If the AI provider is down or no API key is configured, Reel Consensus falls back to a local parser and the product still works.

## Architecture

```text
src/
├── components/          product UI
├── data/                curated demo movie catalogue
├── domain/
│   ├── decisionEngine   participant scoring + fairness + explanations
│   ├── intentParser     deterministic natural-language fallback
│   └── types            domain contracts
├── lib/                 AI intent client boundary
└── App.tsx              session composition + product flow

api/
└── interpret.ts         optional OpenRouter serverless intent parser

e2e/
└── smoke.spec.ts        critical browser flows
```

## Stack

- React 19
- TypeScript
- Vite
- Vercel Functions
- OpenRouter-compatible AI endpoint
- Vitest + Testing Library
- Playwright
- ESLint
- GitHub Actions

## Local development

Requires Node.js 22.13+.

```bash
npm install
npm run dev
```

The product works without AI configuration.

## Optional AI configuration

Copy the environment template:

```bash
cp .env.example .env.local
```

Set:

```bash
OPENROUTER_API_KEY=...
OPENROUTER_MODEL=...
```

`OPENROUTER_MODEL` is intentionally not hard-coded because available models and pricing change. Use a model currently available to your OpenRouter account.

For local testing of the Vercel API route, use `vercel dev` or deploy the project to Vercel. Plain `vite` development will automatically fall back to the local intent parser because `/api/interpret` is unavailable.

## Quality commands

```bash
npm run lint
npm test
npm run build
npm run test:e2e
npm run check
```

## Reliability rules

- Participant vetoes are hard constraints, not weak negative weights.
- Group-wide hard constraints run before preference scoring.
- AI never selects the final movie.
- Model output is validated against allowed genres, moods, runtime, and rating ranges.
- An unavailable or malformed AI response falls back safely.
- The UI exposes trade-offs rather than pretending every recommendation is perfect.

## Data scope

The MVP uses a small bundled catalogue so the decision logic is easy to inspect and test. A production version should replace this boundary with a server-side movie/provider data source such as TMDB while keeping the same scoring engine.

## Roadmap

- Real movie discovery/provider integration.
- Shareable movie-night sessions.
- Pairwise “Battle Mode” preference learning.
- Post-watch feedback and preference history.
- Turn-taking fairness using historical outcomes.
- “Why not this movie?” conversational explanations.

## Positioning

This is intentionally not another movie search or favorites app. The core product is **multi-person decision support**: make disagreement measurable, preserve vetoes, and optimize for a compromise people can actually accept.
