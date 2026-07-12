---
name: Corda
description: A performance chord book for live keyboardists — dark stage, one gold light.
colors:
  gold: "#C9A84C"
  void-bg: "#080808"
  surface-low: "#0F0F0E"
  surface: "#141414"
  surface-high: "#1E1E1E"
  ink: "#F5F0E8"
  ink-dim: "#F0EBE2"
  muted: "#5A5A5A"
  muted-low: "#444444"
  danger: "#C04040"
  danger-deep: "#8A2020"
  success: "#5A9E5A"
  success-deep: "#2A4A2A"
typography:
  display:
    fontFamily: "Playfair Display, Georgia, serif"
    fontSize: "clamp(2rem, 8vw, 3.25rem)"
    fontWeight: 700
    lineHeight: 1.05
    letterSpacing: "-0.015em"
  headline:
    fontFamily: "Playfair Display, Georgia, serif"
    fontSize: "1.375rem"
    fontWeight: 500
    lineHeight: 1.15
    letterSpacing: "normal"
  body:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
  label:
    fontFamily: "Inter, -apple-system, sans-serif"
    fontSize: "0.6875rem"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "0.14em"
  mono:
    fontFamily: "Fragment Mono, ui-monospace, SFMono-Regular, monospace"
    fontSize: "0.9375rem"
    fontWeight: 400
    lineHeight: 1.35
    letterSpacing: "normal"
rounded:
  sm: "6px"
  md: "8px"
  lg: "10px"
  xl: "16px"
  pill: "100px"
spacing:
  xs: "6px"
  sm: "10px"
  md: "16px"
  lg: "24px"
components:
  button-primary:
    backgroundColor: "{colors.gold}"
    textColor: "{colors.void-bg}"
    rounded: "{rounded.md}"
    padding: "10px 18px"
    typography: "{typography.label}"
  button-ghost:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.gold}"
    rounded: "{rounded.md}"
    padding: "10px 18px"
    typography: "{typography.label}"
  pill-active:
    backgroundColor: "{colors.gold}"
    textColor: "{colors.void-bg}"
    rounded: "{rounded.pill}"
    padding: "6px 14px"
    typography: "{typography.label}"
  pill:
    backgroundColor: "{colors.surface-high}"
    textColor: "{colors.muted}"
    rounded: "{rounded.pill}"
    padding: "6px 14px"
    typography: "{typography.label}"
  card:
    backgroundColor: "{colors.surface-low}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "16px"
  input:
    backgroundColor: "{colors.surface-low}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "10px 12px"
---

# Design System: Corda

## 1. Overview

**Creative North Star: "The Studio Rack"**

Corda looks like pro audio gear, not a webapp. The surface is machined and near-black; every control is precise and restrained; a single warm gold reads as the one status light on the panel. It is designed for the hardest moment there is — a keyboardist glancing at a phone mid-set, one-handed, in a dark room, under an audience — so the whole system optimizes for *calm command*: read it in a fraction of a second, act, keep playing. Sharp, fast, pro-grade. Beauty is in the tight tolerances, never in decoration.

The palette is a void with one light. Black (`#080808`) is the room; near-black tinted steps (`#0F0F0E`→`#1E1E1E`) are the rack panels stacked on it; warm cream ink (`#F5F0E8`) is what you read; **Stage Gold** (`#C9A84C`) is the single warm signal, spent sparingly on what matters. Type carries the heritage: Playfair Display for song titles and the key display (music-print gravity), Inter for every label and control (unfussy, legible), and Fragment Mono for chord charts so chords column-align perfectly above their lyrics.

Corda explicitly rejects four things. It is **not** an ad-heavy, cramped guitar-tab dump; **not** a blue-and-white SaaS dashboard with hero-metric card grids; **not** a bright, gamified consumer music app; and **not** skeuomorphic fake-hardware with wood grain and LED meters. It reads as a real instrument because the restraint is real, not because it imitates one.

**Key Characteristics:**
- Void-black surface, one gold signal light — never a second accent competing for attention.
- Glanceable-first: high cream-on-black contrast, generous tap targets, type sized to read at arm's length in the dark.
- Music-print typography: Playfair titles, Fragment Mono chord charts that column-align.
- Precise, restrained controls — tight radii, crisp states, nothing that bounces.

## 2. Colors

A void with a single warm light: black room, near-black panels, cream ink, one gold signal.

### Primary
- **Stage Gold** (`#C9A84C`): The one warm light in the dark. The signal color — active pills, primary buttons, focus rings, favorite stars, the wordmark rule, key badges. Spent deliberately, never as fill-by-the-yard. Its transparencies (`rgba(201,168,76,.06–.25)`) carry the same voice at lower volume: hover borders, soft glows, hairline separators.

### Neutral
- **Void** (`#080808`): The room. Body background and Gig Mode canvas — true near-black, so the ink and the gold do the work.
- **Rack Panels** (`#0F0F0E` → `#141414` → `#1E1E1E`): Layered near-black surfaces, faintly warm-tinted, that stack to convey depth. Cards, expanded detail, inputs, the darkest-to-lightest step tells you what sits above what.
- **Cream Ink** (`#F5F0E8`, secondary `#F0EBE2`): Primary reading color for song names, lyrics, values. Warm-white for legibility on black without the harsh glare of pure `#FFF`.
- **Muted Metal** (`#5A5A5A`, deeper `#444444`): Metadata, secondary labels, inactive pill text, placeholder copy. The quiet register — used for things you scan past, not read.

### Tertiary (semantic only)
- **Signal Red** (`#C04040`, deep `#8A2020`): Destructive and warning state only — delete confirmations, the "no chord chart" `!` flag. Never decorative.
- **Signal Green** (`#5A9E5A`, deep `#2A4A2A`): Positive state only — success, "chords present" confirmations. Never decorative.

### Named Rules
**The One Light Rule.** There is exactly one accent: Stage Gold. No second brand color ever joins it. Red and green exist only to signal danger and success, never to decorate. If a screen has two colors fighting to be the highlight, one of them is wrong.

**The Warm-White Rule.** Reading text is `#F5F0E8`, never pure `#FFFFFF`. Pure white glares against `#080808`; the warm cream is what makes long chord charts readable at a glance on a bright stage.

## 3. Typography

**Display Font:** Playfair Display (with Georgia, serif fallback)
**Body Font:** Inter (with -apple-system, BlinkMacSystemFont fallback)
**Mono Font:** Fragment Mono (with ui-monospace, SFMono-Regular fallback)

**Character:** A three-way pairing on hard contrast axes — a high-contrast serif for gravity, a neutral grotesque for controls, a fixed-width mono for chords. Nothing is "similar but not identical"; each font has one job and never crosses into another's.

### Hierarchy
- **Display** (Playfair 700, `clamp(2rem, 8vw, 3.25rem)`, line-height ~1.05): Song names in Gig Mode and the app wordmark. The single largest voice; carries the music-print gravity. Never above ~3.25rem — glanceable, not shouting.
- **Headline** (Playfair 500, ~1.375rem): Key display, section titles, expanded song name. Serif register for anything that names a piece of music.
- **Title** (Inter 600, ~0.9375rem): Card song names in the library list, tab labels. Where Inter needs to feel like a heading.
- **Body** (Inter 400, ~0.8125rem, line-height 1.5): Lyrics, notes, field values, general UI text. Warm cream on near-black.
- **Label** (Inter 600, ~0.6875rem, letter-spacing `0.14em`, often uppercase): Metadata, pill text, button text, small-caps section markers in chord charts. The tracked, quiet workhorse.
- **Chord (Mono)** (Fragment Mono 400, ~0.9375rem): Chord charts everywhere — cards, editors, Gig Mode. Fixed-width so a chord row column-aligns above its lyric row. Swappable from one constant (`MONO`) app-wide.

### Named Rules
**The Column-Align Rule.** Chord charts are *always* Fragment Mono (or another fixed-width face). A chord sitting over the wrong syllable is a performance error, not a style nit. Proportional fonts are forbidden anywhere a chord sits above a lyric.

**The Serif-For-Music Rule.** Playfair names music — song titles, keys, the wordmark. Inter runs the machine — labels, buttons, controls. Do not use Playfair for UI chrome or Inter for a song title.

## 4. Elevation

Surfaces are **flat at rest.** Depth is carried first by warm-tinted near-black tint steps (`#0F0F0E`→`#1E1E1E`) — the darker-to-lighter step tells you what layer a panel lives on, no shadow required. Shadows are not ambient; they appear only as a *response to state.* Touch or hover a song card and a soft black drop-shadow blooms under it (felt more than seen on the black canvas — it's the falloff of the panel edge); focus an input and a gold glow ring answers. Gold never casts the shadow; a faint gold hairline ring (`0 0 0 1px rgba(201,168,76,.09)`) rides the hover shadow, the panel's edge catching the one light.

### Shadow Vocabulary
- **Setlist hover** (`box-shadow: 0 4px 24px rgba(0,0,0,0.7)`): Setlist rows on hover — lifts off the void in response to the pointer.
- **Song-card hover** (`box-shadow: 0 6px 36px rgba(0,0,0,0.85), 0 0 0 1px rgba(201,168,76,0.09)`): Song card on hover — deep black shadow plus the gold edge-catch. Absent at rest.
- **Focus ring** (`box-shadow: 0 0 0 3px rgba(201,168,76,0.05); border-color: rgba(201,168,76,0.35)`): Every input/select/textarea on focus — a soft gold glow, never a hard OS outline.

### Named Rules
**The Flat-By-Default Rule.** Surfaces are flat at rest; depth comes from tint steps alone. Shadows appear only as a response to state (hover, focus) — never as a persistent, ambient lift. If a card is casting a shadow while nothing is touching it, the shadow is wrong.

**The Shadow-Is-Black Rule.** Shadows are pure black at high opacity — that's how you get depth on a near-black surface. Gold is a light source, never a shadow. If an element looks like it's glowing gold from underneath, the ring opacity is too high.

## 5. Components

### Buttons
- **Shape:** Softly squared (`8px` radius, `rounded.md`). Tight, machined — never pill-round unless it's a filter pill.
- **Primary:** Stage Gold fill (`#C9A84C`), void-black text (`#080808`), label typography (Inter 600, tracked). Padding ~`10px 18px`. The one loud control on a screen — used once, for the main action.
- **Ghost / Secondary:** Panel surface (`#141414`) or transparent, gold border and gold text. The default for everything that isn't the single primary action.
- **Hover / Focus:** Subtle — a slight lift and glow, no bounce, no scale-up. Presses feel like real buttons: a small `scale(0.94–0.99)` on `:active` for tactile confirmation.

### Chips / Filter Pills
- **Shape:** Fully round (`rounded.pill`, `100px`).
- **Active:** Gold fill (`#C9A84C`), black text — the selected filter reads as lit.
- **Inactive:** Panel surface (`#1E1E1E`), muted-metal text (`#5A5A5A`), no border. Recedes.
- **State:** Press gives `scale(0.94)`. A right-edge black gradient fade signals the pill row scrolls horizontally.

### Cards / Containers
- **Corner Style:** Gently squared (`10px`, `rounded.lg`); expanded detail and larger panels step up to `16px` (`rounded.xl`).
- **Background:** Darkest panel step (`#0F0F0E`), often a faint top-to-bottom gradient into `#141414`.
- **Shadow Strategy:** Flat at rest — see Elevation. No shadow at rest; hover blooms the deep black shadow and adds the gold edge-ring.
- **Border:** Hairline only. On hover, the leading edge warms to `rgba(201,168,76,0.75)`.
- **Internal Padding:** `16px` (`spacing.md`).

### Inputs / Fields
- **Style:** Dark panel fill (`#0F0F0E`), hairline border, `8px` radius. Cream text, muted-metal placeholder.
- **Focus:** Gold glow ring (`0 0 0 3px rgba(201,168,76,0.05)`) + border shift to `rgba(201,168,76,0.35)`. No hard outline.
- **Inline-save behavior:** Fields save on blur — treat the field as the source of truth, not a separate submit.

### Navigation
- **Style:** Fixed bottom tab bar (~64px), five tabs, icon + label. Active tab in Stage Gold with a top underline; inactive in muted metal. Active icon plays a one-shot `navPop` scale pulse (respect reduced-motion).
- **Mobile:** Safe-area insets for the iPhone notch and home bar. This is a phone-first tool used on stage; the desktop is the exception.

### Gig Mode (Signature Component)
The reason Corda exists. Full-screen void overlay, wake-lock so the screen never sleeps. Song name in Playfair (~52px), chord chart in Fragment Mono at reading size, section labels centered small-caps. `+`/`−` transpose in the top corners, a key badge with the live semitone offset, swipe left/right between songs, `A−`/`A+` font-size control. Everything is glanceable-at-distance and one-handed. This screen answers every design decision above: if a choice doesn't help someone read it mid-performance, it loses.

## 6. Do's and Don'ts

### Do:
- **Do** keep Stage Gold (`#C9A84C`) as the single accent — active pills, primary action, focus, favorites. One light in the room.
- **Do** read text in warm cream (`#F5F0E8`), never pure white, against the `#080808` void.
- **Do** set every chord chart in Fragment Mono so chords column-align over their lyrics.
- **Do** convey depth with warm near-black tint steps (`#0F0F0E`→`#1E1E1E`) and let pure-black shadows appear only on hover/focus, never at rest.
- **Do** size and space stage-facing views to be read one-handed, at arm's length, in the dark — legibility beats density.
- **Do** give controls crisp, restrained feedback (`scale(0.94–0.99)` on press); provide a reduced-motion path for every animation.

### Don't:
- **Don't** add a second accent color. Red and green are *state signals only* (danger / success), never decoration — that breaks The One Light Rule.
- **Don't** look like a cluttered guitar-tab site — no cramped ad-slabs, no amateur chord dumps. Space and hierarchy are the whole point.
- **Don't** drift into generic SaaS-dashboard territory — no blue-and-white card grids, no hero-metric template, no startup boilerplate chrome.
- **Don't** go bright, playful, or gamified like a consumer music app. Corda is pro gear, not Duolingo-for-music.
- **Don't** fake hardware — no wood grain, no imitation LED meters, no skeuomorphic textures. The instrument feeling comes from restraint, not mimicry.
- **Don't** use pure `#FFFFFF` text or gold as a fill-by-the-yard; both destroy the void-with-one-light effect.
- **Don't** let a chord chart render in a proportional font — a chord over the wrong syllable is a live performance error.
