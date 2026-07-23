---
name: Corda
description: A performance chord book for live keyboardists — dark stage, one gold light.
colors:
  gold: "#C7B27A"
  void-bg: "#0d0d0f"
  panel: "#131215"
  hairline: "#1e1e22"
  seam: "#232328"
  disabled: "#2a2a30"
  ink: "#EDEBE6"
  ink-secondary: "#c8c6cc"
  lyric: "#e3e0da"
  tertiary: "#7a7982"
  dim: "#5c5b63"
  danger: "#8a4b4b"
  danger-deep: "#8A2020"
  success: "#5A9E5A"
  success-deep: "#2A4A2A"
typography:
  display:
    fontFamily: "Space Grotesk, sans-serif"
    fontSize: "34px"
    fontWeight: 700
    lineHeight: 1.05
    letterSpacing: "-0.01em"
    textTransform: uppercase
  headline:
    fontFamily: "Space Grotesk, sans-serif"
    fontSize: "18px"
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
    fontFamily: "Space Mono, ui-monospace, monospace"
    fontSize: "9px"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "0.2em"
    textTransform: uppercase
  mono:
    fontFamily: "Space Mono, ui-monospace, SFMono-Regular, monospace"
    fontSize: "13px"
    fontWeight: 700
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

**Creative North Star: "The Instrument Rack"**

Corda looks like a piece of pro rack gear — a machined front panel of stacked modules — not a webapp. Surfaces are near-black and square-cornered; controls are grouped into physically-routed strips with visible seams; rows are separated by hairline dividers, not shadows or margins. A single warm gold reads as the one status light on the panel. It is designed for the hardest moment there is — a keyboardist glancing at a phone mid-set, one-handed, in a dark room, under an audience — so the whole system optimizes for *calm command*: read it in a fraction of a second, act, keep playing. Sharp, fast, pro-grade. Beauty is in the tight tolerances and the grid, never in decoration.

The palette is a dark rack with one light. `#0d0d0f` is the chassis; near-black tint steps (`#131215` panels, `#1e1e22` hairlines, `#232328` seams) are the modules routed onto it; warm ink (`#EDEBE6`) is what you read; **Rack Gold** (`#C7B27A`) is the single warm signal, spent sparingly on what matters. Type carries three distinct jobs: **Space Grotesk** for large titles, song names and lyrics (display gravity); **Space Mono** for chords, keys and tick-mark labels (fixed-width, instrument-panel readout); **Inter** for UI chrome, artist names and metadata (unfussy, legible).

Corda explicitly rejects four things. It is **not** an ad-heavy, cramped guitar-tab dump; **not** a blue-and-white SaaS dashboard with hero-metric card grids; **not** a bright, gamified consumer music app; and **not** skeuomorphic fake-hardware with wood grain and LED meters. It reads as a real instrument because the restraint and the grid are real, not because it imitates one.

**Key Characteristics:**
- Square corners and 1px hairline dividers — rows are separated by rules, not cards floating in space.
- One gold signal light — never a second accent competing for attention.
- Grouped controls built as seamed strips (1px gaps on `#232328`) so transpose, gig nav and reorder read as routed hardware.
- Glanceable-first: high ink-on-near-black contrast, generous tap targets, type sized to read at arm's length in the dark.
- Three-font system: Space Grotesk titles/lyrics, Space Mono chord/readout labels that column-align, Inter chrome.

## 2. Colors

A dark rack with a single warm light: near-black chassis, tinted panels and seams, warm ink, one gold signal.

### Primary
- **Rack Gold** (`#C7B27A`): The one warm light on the panel. The signal color — active filter pills, primary buttons, focus rings, favorite stars, the wordmark mark, key readouts, chord symbols. Spent deliberately, never as fill-by-the-yard. Its transparencies (`rgba(199,178,122,.06–.25)`) carry the same voice at lower volume: hover borders, soft glows, seam accents.

### Neutral
- **Chassis** (`#0d0d0f`): The body background and Gig Mode canvas — near-black, so the ink and the gold do the work.
- **Panels & Seams** (`#131215` panel → `#1e1e22` hairline → `#232328` seam → `#2a2a30` disabled): Layered near-black surfaces. `#131215` is a card/inset panel; `#1e1e22` draws the hairline rules between list rows; `#232328` is the seam background a grouped control strip sits on so each segment reads as physically routed; `#2a2a30` is a disabled control glyph.
- **Ink** (`#EDEBE6` primary, `#c8c6cc` secondary, `#e3e0da` lyrics): Reading colors for song names, values and lyrics. Warm off-white for legibility on near-black without the harsh glare of pure `#FFF`.
- **Tertiary / Dim** (`#7a7982` tertiary, `#5c5b63` dim): Metadata, artist names, tick-mark labels, inactive tab text, placeholder copy. The quiet register — used for things you scan past, not read.

### Tertiary (semantic only)
- **Destructive** (`#8a4b4b`): Remove / delete affordances and the "no chord chart" flag only. Never decorative.
- **Success** (`#5A9E5A`, deep `#2A4A2A`): Positive state only — "Saved ✓", "chords present" confirmations. Never decorative.

### Named Rules
**The One Light Rule.** There is exactly one accent: Rack Gold. No second brand color ever joins it. Destructive-red and success-green exist only to signal danger and success, never to decorate. If a screen has two colors fighting to be the highlight, one of them is wrong.

**The Warm-White Rule.** Reading text is `#EDEBE6`, never pure `#FFFFFF`. Pure white glares against `#0d0d0f`; the warm ink is what makes long chord charts readable at a glance on a bright stage.

## 3. Typography

**Display Font:** Space Grotesk (with sans-serif fallback)
**Mono Font:** Space Mono (with ui-monospace, SFMono-Regular fallback)
**Chrome Font:** Inter (with -apple-system, BlinkMacSystemFont fallback)

**Character:** A three-way pairing on clear job boundaries — a geometric grotesque display face for titles and lyrics, a fixed-width mono for chords and instrument readouts, a neutral UI grotesque for chrome. Each font has one job and never crosses into another's.

### Hierarchy
- **Large Title** (Space Grotesk 700, `34px`, uppercase, tracking `-0.01em`): iOS-style screen titles (Songs, Key Finder, Setlist) and the Gig Mode song name (`30px`). The largest voice; collapses into a pinned compact bar on scroll.
- **Headline / Song name** (Space Grotesk 500, `18px`): Card song names in the library list, setlist track names. Display register for anything that names a piece of music.
- **Chord & Readout (Mono)** (Space Mono 700, `13–16px`, gold): Chord charts and the Gig Mode key readout. Fixed-width so a chord row column-aligns above its lyric row. Swappable from one constant (`MONO`) app-wide.
- **Tick Label (Mono)** (Space Mono 700, `9–11px`, tracking `0.16–0.22em`, uppercase, dim `#5c5b63`): Section markers everywhere — "BEST KEY FOR CROWD", "TRACKS", "CAPO SHAPES FOR G". The instrument-panel silkscreen. Tab labels use Space Mono 600.
- **Body / Chrome** (Inter 400, `0.8125rem`, line-height 1.5): Artist names, notes, field values, metadata, general UI text.

### Named Rules
**The Column-Align Rule.** Chord charts and readouts are *always* Space Mono (or another fixed-width face). A chord sitting over the wrong syllable is a performance error, not a style nit. Proportional fonts are forbidden anywhere a chord sits above a lyric.

**The Three-Jobs Rule.** Space Grotesk names music (titles, song names, lyrics). Space Mono runs the panel (chords, keys, tick labels). Inter runs the chrome (controls, metadata, artist names). Do not use a display title in Inter or a chord chart in a proportional font.

## 4. Elevation

Surfaces are **flat.** Corda has no ambient shadows — depth and separation come from the grid, not from lift. Rows are divided by 1px hairline rules (`#1e1e22`); panels sit on the chassis as flat near-black rectangles (`#131215`); grouped controls read as raised only because a 1px seam background (`#232328`) shows between their segments. The only "elevation" event is state: focus an input and a soft gold glow ring answers; press a row or button and it scales to `0.97` for tactile confirmation. Nothing floats, nothing drops a drop-shadow.

### State Vocabulary
- **Press** (`transform: scale(0.97)` on `:active`, via `.press`): Every interactive row, seam cell and button — a small mechanical give.
- **Focus ring** (`box-shadow: 0 0 0 3px rgba(199,178,122,0.05); border-color: rgba(199,178,122,0.35)`): Every input/select/textarea on focus — a soft gold glow, never a hard OS outline.
- **Seam grid** (`1px` gaps on `#232328`): Grouped transport controls (transpose, gig nav, setlist reorder, root grid) — the seam *is* the separation; no shadow needed.

### Named Rules
**The Flat Rule.** Surfaces are flat. Separation comes from hairlines and seams, never from ambient shadow or lift. If an element is casting a drop-shadow, it's wrong.

**The Seam-Is-Structure Rule.** Grouped controls are a single 1px-gap grid on a `#232328` background so each segment reads as a physically routed strip. Don't fake the grouping with margins or borders — route it through the seam.

## 5. Components

### Buttons
- **Shape:** Square corners (`0` radius) for primary/destructive actions; small chrome (search field, seam strips, boxed transport) is the only rounding — `10–12px`, matching physical-control-like elements.
- **Primary:** Rack Gold fill (`#C7B27A`), chassis-black text (`#0d0d0f`), mono label (Space Mono 700, tracked, uppercase). Padding ~`16px`. The one loud control on a screen — used once, for the main action.
- **Ghost / Secondary:** Transparent, gold hairline border (`rgba(199,178,122,0.22)`) and gold text. The default for everything that isn't the single primary action.
- **Press:** `scale(0.97)` on `:active` — presses feel like real panel buttons. No bounce on chrome (bounce/spring easing is reserved for the segmented pill and expand animations).

### Chips / Filter Pills
- **Shape:** Square (`0` radius) mono seam pills — event and tag filters route through a `#232328` seam grid.
- **Active:** Gold fill or gold text on a lighter fill (`#1c1c20`) — the selected filter reads as lit.
- **Inactive:** Chassis background, dim text (`#5c5b63`). Recedes.
- **Segmented control (ALL / ★ FAVORITES):** A two-way track with a sliding highlight pill on spring easing (`cubic-bezier(0.34,1.56,0.64,1)`, `0.4s`) — the one place a control is allowed to overshoot.
- **State:** Press gives `scale(0.94)` via `.pill`. Tag rows scroll horizontally.

### Cards / Containers
- **Corner Style:** Inset chord/detail panels use `8px`; seam strips and root grids use `10px`. List rows are *not* cards — they are hairline-divided rows in a flat list.
- **Background:** Panel step (`#131215`) for insets; chord-editor boxes drop to `#0a0a0c` with a gold hairline.
- **Separation:** 1px hairline rule (`#1e1e22`) between rows — never a shadow, never a floating card.
- **Internal Padding:** `16px` (`spacing.md`); rows pad `14–16px` vertically.

### Inputs / Fields
- **Style:** Dark panel fill (`#0f0f11`), hairline border (`#1e1e22`), **square** (`0` radius). Ink text, dim placeholder. The search field is the exception — `12px` rounded, translucent, as rack chrome.
- **Focus:** Gold glow ring (`0 0 0 3px rgba(199,178,122,0.05)`) + border shift to `rgba(199,178,122,0.35)`. No hard outline.
- **Inline-save behavior:** Fields save on blur — treat the field as the source of truth, not a separate submit.

### Navigation
- **Style:** Fixed bottom tab bar, **four** tabs (Songs ♪ / Gig ▶ / Key ♯ / Setlist ≡), icon + mono label. Blurred translucent background (`rgba(13,13,15,0.82)`, `blur(20px) saturate(160%)`), hairline top border. Active tab in Rack Gold; inactive dim. Active icon plays a one-shot `navPop` scale pulse (`1 → 1.22 → 1`).
- **Header:** A slim utility bar (brand mark + sign out) carries no screen identity — each screen owns an iOS large title that collapses into a pinned, blurred compact header over the first 50px of scroll.
- **Mobile:** Safe-area insets for the iPhone notch and home bar. This is a phone-first tool used on stage; the desktop is the exception.

### Gig Mode (Signature Component)
The reason Corda exists. Full-screen chassis overlay, wake-lock so the screen never sleeps. Song name in Space Grotesk (`30px`, uppercase), chord chart in Space Mono at reading size, section labels small-caps. A seamed `[−] [KEY readout] [+]` transpose strip up top — the key readout pulses (`keyPop`) on change and carries the live semitone offset and a save-key affordance. Swipe left/right between songs (directional slide+fade); a seamed prev / `A− · A+` / next strip along the bottom with disabled graying at list boundaries. Everything is glanceable-at-distance and one-handed. This screen answers every design decision above: if a choice doesn't help someone read it mid-performance, it loses.

## 6. Do's and Don'ts

### Do:
- **Do** keep Rack Gold (`#C7B27A`) as the single accent — active pills, primary action, focus, favorites, chords. One light on the panel.
- **Do** read text in warm ink (`#EDEBE6`), never pure white, against the `#0d0d0f` chassis.
- **Do** separate list rows with 1px hairline rules (`#1e1e22`) and group controls into seamed strips (`#232328`) — the grid is the structure.
- **Do** set every chord chart and readout in Space Mono so chords column-align over their lyrics.
- **Do** keep corners square; round only physical-control chrome (search field, seam strips, transport) at `10–12px`.
- **Do** size and space stage-facing views to be read one-handed, at arm's length, in the dark — legibility beats density.
- **Do** give controls crisp `scale(0.97)` press feedback; reserve spring/overshoot easing for the segmented pill and expand animations.

### Don't:
- **Don't** add a second accent color. Destructive-red and success-green are *state signals only*, never decoration — that breaks The One Light Rule.
- **Don't** float cards or drop ambient shadows — separation is hairlines and seams, not lift. A shadow at rest is wrong.
- **Don't** round primary actions, list rows or fields — square corners are the rack. Rounding is only for control-like chrome.
- **Don't** look like a cluttered guitar-tab site, a blue-and-white SaaS dashboard, or a bright gamified music app. Space, grid and hierarchy are the whole point.
- **Don't** fake hardware — no wood grain, no imitation LED meters, no skeuomorphic textures. The instrument feeling comes from the grid and restraint, not mimicry.
- **Don't** use pure `#FFFFFF` text or gold as a fill-by-the-yard; both destroy the rack-with-one-light effect.
- **Don't** let a chord chart render in a proportional font — a chord over the wrong syllable is a live performance error.
