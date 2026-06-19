# Corda — Roadmap

A performance chord book for a live Jewish music keyboardist. Built to be used on stage: browse songs, see chord charts with inline lyrics, transpose on the fly, and run a full-screen Gig Mode during a set.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + Vite |
| Styling | Inline styles + Google Fonts (Playfair Display, Inter) |
| Database | Supabase (PostgreSQL) |
| Hosting | Vercel (serverless functions + static) |
| Chord AI | Gemini 2.5 Flash via `/api/chords.js` with Google Search grounding |
| Fill AI | Claude Sonnet via `/api/claude.js` |
| PWA | Web App Manifest + Service Worker + PNG icons |

---

## Completed Features

### Core Song Library
- [x] Song list backed by Supabase `songs` table
- [x] Alphabetical grouping with letter headers (ignoring The/A/An)
- [x] Search by song name or artist
- [x] Event type filter pills: All, Kumzitz, Sheva Brachos, Wedding
- [x] ★ Favorites filter pill
- [x] Dynamic song count in header (`· 78 songs`)
- [x] Expandable song cards with full detail editor
- [x] Fields: name, artist, key, event type, patch/sound, tempo, BPM, tags, chords, notes
- [x] Inline save on blur for all fields
- [x] Star/unstar favorites
- [x] Delete song

### Chord Charts
- [x] `[chord]` inline notation parser and renderer
- [x] Chord+lyric couplet display: chord row in gold above lyric row in cream, monospace aligned
- [x] Section headers (Verse, Chorus, Bridge, etc.) rendered in small caps
- [x] Support for tab-style, pipe-style, and plain text chord formats
- [x] Chord transpose: key dropdown → Transpose button shifts all chords in place
- [x] Save key + transposed chords back to Supabase

### AI Chord Autofill
- [x] `/api/chords.js` — Gemini 2.5 Flash with Google Search grounding
- [x] Prompt returns `TEMPO / NOTES / KEY / CHORDS_LYRICS` in structured format
- [x] Auto-parses and populates tempo, notes, key, and chord chart fields
- [x] ✦ Fill with Chords button on each expanded card
- [x] ✦ Fill All Missing — batch fills all songs with no chords, progress bar, cancel
- [x] Auto-fill on Save Song if no chords entered
- [x] Quota error surfaced inline (HTTP 429 → user-readable message)
- [x] Full raw Gemini response logged to console

### Gig Mode
- [x] Full-screen black overlay, wake lock (screen stays on)
- [x] Song name in 52px Playfair Display, artist in Inter
- [x] Chord chart at 17px, section labels centered
- [x] +/− transpose buttons in top corners
- [x] Key badge display with semitone offset indicator
- [x] Save key button (persists transposed key to database)
- [x] Song X of Y progress + dot indicators for sets ≤ 12 songs
- [x] Swipe left/right to navigate (threshold 60px, horizontal-only)
- [x] ‹ › bottom nav arrows
- [x] visibilitychange re-acquires wake lock after screen sleep

### Set List Builder
- [x] Create named set lists with event type and date
- [x] Add songs by search, drag-and-drop reorder (mouse + touch)
- [x] Remove songs from set
- [x] ▶ Play button launches Gig Mode with the set list
- [x] Persisted in Supabase `setlists` + `setlist_songs` tables

### Key Finder
- [x] Crowd type selector (men, mixed, women, kids, older, young)
- [x] Energy level (strong, medium, passive)
- [x] Optional singer inputs: voice type, top comfortable note, song range
- [x] Suggests best key + 3 alternates based on MIDI range math
- [x] Apply to song: searchable dropdown of all songs → sets key in database
- [x] Singer profile saved to `localStorage` (auto-loads on mount)
- [x] Save / Clear profile buttons

### Patches Tab
- [x] Reference guide for keyboard patches: Piano, Pads, Lead & Color
- [x] Each patch shows: name, source plugin, when to use

### Add Song Tab
- [x] Form with all fields (name, artist, key, event, patch, tempo, BPM, tags)
- [x] ✦ Search Chords button calls Gemini before saving
- [x] ⌕ Google link for manual chord lookup
- [x] Chord preview rendered live above the textarea
- [x] Navigates back to Songs on save

### Design & PWA
- [x] Awwwards-style dark aesthetic: `#080808` background, gold `#C9A84C` accent
- [x] Playfair Display (serif) for song names, app title, key display
- [x] Inter for all UI labels, buttons, metadata
- [x] "Corda" wordmark with minimalist musical staff SVG + gold gradient rule
- [x] Cards: gradient bg, 3px gold left border, 14px radius
- [x] Bottom nav: 64px, active tab in gold + top underline
- [x] Filter pills: active = gold fill / black text
- [x] Buttons: primary = gold bg / black text; secondary = gold border / gold text
- [x] PWA: Web App Manifest, service worker, `icon-192.png` + `icon-512.png`
- [x] Safe area insets for iPhone notch/home bar
- [x] App renamed Niggun → Corda everywhere

---

## Remaining / Planned

### High Priority
- [ ] Connect GitHub repo to Vercel for automatic deploys on push
- [ ] Enable Gemini API billing (current key: 20 req/day free tier limit)
- [ ] Add `tags` and `bpm` columns to Supabase `songs` table (`ALTER TABLE songs ADD COLUMN IF NOT EXISTS tags text, ADD COLUMN IF NOT EXISTS bpm integer`)

### Features
- [x] Tag-based filtering in the Songs tab (filter by tag pill)
- [x] BPM display in Gig Mode (next to tempo)
- [x] Song notes visible in Gig Mode
- [x] Font size control in Gig Mode (A− / A+ buttons in bottom bar)
- [x] Play single song in Gig Mode from expanded card (▶ Play button)
- [x] Play filtered song list directly from Songs tab (▶ button in search row)
- [x] Two-step delete confirmation (Remove → Delete? Yes/No)
- [ ] Setlist: show total duration estimate based on average song length
- [ ] Quick-add song from Gig Mode (add a placeholder mid-performance)
- [ ] Chord chart print/export (PDF or share sheet)
- [ ] Search within chord charts (find a specific word/section)
- [ ] Song history / recently played

### Infrastructure
- [ ] Auth (Supabase Auth) — currently open/unprotected
- [ ] Multi-user support or shared library mode
- [ ] Offline mode — cache songs in IndexedDB for no-internet gigs
- [ ] Supabase RLS (Row Level Security) policies
