# Reel Consensus brand system

## Brand idea

**Reel Consensus turns different tastes into one movie everyone can get behind.**

The identity is built around three ideas:

1. **Cinema** — film reels, editorial typography, warm theatre tones.
2. **People** — two overlapping reel/person forms represent different tastes in the same room.
3. **Consensus** — the shared overlap and check mark represent a fair decision, not a majority steamroll.

## Primary positioning

**Less debate. More movie nights.**

Supporting product line:

> One movie. Everyone on board.

## Brand attributes

- **Cinematic** — feels connected to movie night, not generic SaaS.
- **Warm** — made for couples, friends and families.
- **Fair** — every person has a visible voice.
- **Premium** — thoughtful editorial presentation without becoming ornate.
- **Clear** — product UI stays simple even when the brand has personality.

## Core palette

| Token | Hex | Role |
| --- | --- | --- |
| Cinematic Burgundy | `#7A1F2B` | identity, warm emphasis, selected states |
| Midnight Black | `#0B0B0B` | deep background |
| Consensus Gold | `#D4AF37` | primary action, score, premium accents |
| Warm Cream | `#F4E8D1` | headlines and high-contrast text |
| Harmony Lavender | `#A78BFA` | AI assist, harmony, secondary consensus cue |

The UI uses softer derived values where needed for accessible contrast.

## Typography

### Display
Use an elegant editorial serif for hero headlines and high-emotion moments.

Current implementation intentionally uses a system serif stack for reliability:

```css
"Iowan Old Style", "Palatino Linotype", "Book Antiqua", Palatino, Georgia, serif
```

A self-hosted Playfair Display can replace it later without changing the design system.

### Interface
Use the system sans-serif stack for controls, labels, chips, forms and explanatory copy.

## Logo assets

### Production vectors

- `public/brand/reel-consensus-mark.svg` — compact product mark.
- `public/brand/reel-consensus-lockup.svg` — full horizontal identity.

The compact mark is preferred for favicon, mobile header, app icon, loading state and small social/avatar usage.

The lockup is preferred for the application header, footer, README and other wide product surfaces.

### Generated master / source assets

- `public/brand/reel-consensus-logo-master.webp` — compact transparent raster reference derived from the generated primary logo.
- `docs/branding/reel-consensus-brand-board.webp` — compressed brand identity board.
- `docs/branding/reel-consensus-landing-direction.webp` — compressed landing-page direction reference.

The generated master is preserved as the visual source reference, while the application deliberately uses the production SVG lockup and mark: they are sharper, lighter and more legible at UI sizes. The reference boards guide hierarchy, mood and palette; they are not embedded as literal application screens.

## UI mapping

### Header
Use the compact mark plus an accessible text wordmark. Do not shrink the full lockup until the lettering becomes unreadable.

### Hero
Keep the hero editorial and emotionally warm. Gold is reserved for the promise and primary action, while burgundy supplies atmosphere.

### Consensus score
The score ring is the strongest place to use gold + lavender together: gold communicates the decision, lavender communicates harmony/assist.

### Participant states
Do not give every participant a brand color. Participant colors are temporary identity cues; the brand palette should remain dominant.

### Hard vetoes
Vetoes use a warmer red derived from burgundy. Never use gold for destructive or blocking meaning.

### Primary CTA
Gold on a dark surface remains the highest-priority action treatment.

## Usage rules

### Do
- keep generous dark negative space;
- let cream typography carry hierarchy;
- use gold sparingly for decisions and actions;
- keep the logo readable at small sizes;
- use the mark as a recognizable product signature.

### Avoid
- gold borders around every component;
- full-page glossy gradients;
- turning every icon into cinema decoration;
- using burgundy for errors and normal selections at the same time;
- placing the detailed reference logo at tiny sizes.

## Product design principle

Brand personality should be strongest at the **entry**, **decision**, and **celebration** moments.

The configuration UI in between should stay restrained, fast and understandable.
