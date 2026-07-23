import { useState, useEffect, useRef } from 'react'
import { supabase } from './supabase'
import './App.css'

const KEYS = ['C','C#','Db','D','Eb','E','F','F#','G','Ab','A','Bb','B']
const PATCHES = [
  'Warm Grand Piano','Upright Piano','Felt Piano (LABS)',
  'Rhodes','Nylon / Pad Hybrid','Strings','Choir Pad',
  'Organ (Analog Lab)','Analog Pad'
]
const CROWD_RANGES = {
  men:{low:48,high:69},mixed:{low:52,high:71},women:{low:57,high:76},
  kids:{low:55,high:74},older:{low:48,high:67},young:{low:52,high:74}
}
const KEY_ROOTS = {
  'C':48,'C#':49,'Db':49,'D':50,'Eb':51,'E':52,'F':53,
  'F#':54,'G':55,'Ab':56,'A':57,'Bb':58,'B':59
}
const NOTE_MIDI = {'D4':62,'E4':64,'F4':65,'G4':67,'A4':69,'B4':71,'C5':72,'D5':74,'E5':76}
const VOICE_RANGES = {
  tenor:{low:48,high:72},baritone:{low:45,high:69},bass:{low:40,high:64},
  alto:{low:53,high:77},soprano:{low:60,high:84},countertenor:{low:53,high:76}
}
const EVENT_COLORS = {
  kumzitz: { bg:'#0a140a', text:'#5a9e5a', border:'#162616' },
  sheva:   { bg:'#0e0a1e', text:'#8b6fd4', border:'#1a1238' },
  wedding: { bg:'#160e02', text:'#c4862a', border:'#281a04' },
  all:     { bg:'#111', text:'#555', border:'#1c1c1c' },
}

// === Design tokens — "instrument rack" redesign ===
const GOLD = '#C7B27A'
const GOLD_DIM = 'rgba(199,178,122,0.25)'
const GOLD_GLOW = 'rgba(199,178,122,0.12)'
// Surfaces
const BG = '#0d0d0f'        // app background
const PANEL = '#131215'     // cards / chord charts / inset panels
const HAIR = '#1e1e22'      // row dividers (hairlines)
const SEAM = '#232328'      // control seams (grouped transport strips)
const DISABLED = '#2a2a30'  // disabled control glyphs
const RED = '#8a4b4b'       // destructive (remove)
// Text
const TXT = '#EDEBE6'       // primary
const TXT2 = '#c8c6cc'      // secondary
const TXT3 = '#7a7982'      // tertiary / metadata
const DIM = '#5c5b63'       // dim labels / inactive
// Type — Space Grotesk (display/titles/lyrics), Space Mono (chords/keys/tick labels), Inter (chrome)
const DISPLAY = "'Space Grotesk', sans-serif"
// Monospace used for all chord charts, key/tempo readouts, tick labels.
const MONO = "'Space Mono', ui-monospace, 'SFMono-Regular', monospace"

const CHROMATIC = ['C','C#','D','Eb','E','F','F#','G','Ab','A','Bb','B']
const KEY_TO_CHROMA = {
  'C':0,'C#':1,'Db':1,'D':2,'Eb':3,'E':4,'F':5,'F#':6,'Gb':6,'G':7,'Ab':8,'G#':8,'A':9,'Bb':10,'A#':10,'B':11
}

// CAGED capo math: shape base chroma; fret = (root - base) mod 12, keep frets 0–4.
const CAGED_BASE = { C:0, A:9, G:7, E:4, D:2 }
function capoShapes(rootChroma) {
  return Object.entries(CAGED_BASE)
    .map(([shape, base]) => ({ shape, fret: ((rootChroma - base) % 12 + 12) % 12 }))
    .filter(o => o.fret <= 4)
    .sort((a, b) => a.fret - b.fret)
    .slice(0, 3)
    .map(o => ({ shape: o.shape, fretLabel: o.fret === 0 ? 'Open (no capo)' : `Capo ${o.fret}` }))
}

function transposeKey(key, semitones) {
  if (!key || semitones === 0) return key
  const base = KEY_TO_CHROMA[key]
  if (base === undefined) return key
  return CHROMATIC[((base + semitones) % 12 + 12) % 12]
}

function transposeChordSymbol(chord, semitones) {
  if (!chord || semitones === 0) return chord
  if (chord.includes('/')) {
    const slash = chord.indexOf('/')
    return transposeChordSymbol(chord.slice(0, slash), semitones) + '/' + transposeChordSymbol(chord.slice(slash + 1), semitones)
  }
  const m = chord.match(/^([A-G][b#]?)(.*)$/)
  if (!m) return chord
  const idx = KEY_TO_CHROMA[m[1]]
  if (idx === undefined) return chord
  return CHROMATIC[((idx + semitones) % 12 + 12) % 12] + m[2]
}

function isChordLyricFormat(text) {
  return Boolean(text && /\[[A-G][b#]?[^\]]*\]/.test(text))
}

const CHORD_TOKEN_RE = /^[A-G][b#]?(m(?:aj\d?)?|min\d?|dim\d?|aug|sus[24]?|add\d?|M|maj\d?)?\d?(\/[A-G][b#]?)?$/

function isChordOnlyLine(line) {
  const tokens = line.trim().split(/\s+/).filter(Boolean)
  return tokens.length > 0 && tokens.every(t => CHORD_TOKEN_RE.test(t))
}

function transposeChordText(text, semitones) {
  if (!text || semitones === 0) return text
  if (isChordLyricFormat(text)) {
    return text.replace(/\[([^\]]+)\]/g, (_, c) => `[${transposeChordSymbol(c, semitones)}]`)
  }
  return text.replace(/\b([A-G][b#]?(?:m(?:aj\d?)?|min\d?|dim\d?|aug|sus[24]?|add\d?)?(?:\d)?(?:\/[A-G][b#]?)?)\b/g,
    (_, c) => transposeChordSymbol(c, semitones))
}

// Parse [chord] inline line into segments: [{chord, text}, ...]
function parseInlineLine(line) {
  const segments = []
  const re = /\[([^\]]+)\]([^[]*)/g
  const firstBracket = line.search(/\[/)
  if (firstBracket > 0) segments.push({ chord: null, text: line.slice(0, firstBracket) })
  let m
  while ((m = re.exec(line)) !== null) segments.push({ chord: m[1], text: m[2] })
  if (segments.length === 0) segments.push({ chord: null, text: line })
  return segments
}

// Convert [chord] inline line → { chordRow, lyricRow } monospace strings
function inlineToCouplet(line) {
  const segs = parseInlineLine(line)
  let chordRow = ''
  let lyricRow = ''
  for (const seg of segs) {
    const chord = seg.chord || ''
    const lyric = seg.text || ''
    // Each column must be wide enough for both chord and lyric
    // Add a trailing space after each chord for readability
    const colW = chord ? Math.max(chord.length + 1, lyric.length) : lyric.length
    chordRow += chord.padEnd(colW)
    lyricRow += lyric.padEnd(colW)
  }
  return { chordRow: chordRow.trimEnd(), lyricRow: lyricRow.trimEnd() }
}

function ChordLyricDisplay({ text, fontSize = 14, centerSections = false }) {
  if (!text) return null

  const lines = text.split('\n')
  const blocks = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]
    const trimmed = line.trim()

    // Empty
    if (!trimmed) { blocks.push({ type: 'gap' }); i++; continue }

    // Section header (e.g. "Verse:", "Chorus:")
    if (/^(Verse|Chorus|Bridge|Intro|Outro|Pre-?Chorus|Hook|Refrain|Tag|Interlude)\s*[:：]/i.test(trimmed) && !trimmed.includes('[')) {
      blocks.push({ type: 'section', text: trimmed }); i++; continue
    }

    // [chord] inline format — convert to chord-row / lyric-row couplet
    if (line.includes('[')) {
      const { chordRow, lyricRow } = inlineToCouplet(line)
      blocks.push({ type: 'couplet', chordRow, lyricRow }); i++; continue
    }

    // "Chords | Lyrics" format — e.g. "Dm Am | Od yishama b'arei"
    if (line.includes('|')) {
      const pipeIdx = line.indexOf('|')
      const left = line.slice(0, pipeIdx).trim()
      const right = line.slice(pipeIdx + 1).trim()
      const leftTokens = left.split(/\s+/).filter(Boolean)
      if (leftTokens.length > 0 && leftTokens.every(t => CHORD_TOKEN_RE.test(t))) {
        blocks.push({ type: 'couplet', chordRow: left, lyricRow: right }); i++; continue
      }
    }

    // Tab-style chord-only line — look ahead for paired lyric line
    if (isChordOnlyLine(trimmed)) {
      const nextLine = lines[i + 1] ?? ''
      const nextTrimmed = nextLine.trim()
      if (nextTrimmed && !nextTrimmed.includes('[') && !isChordOnlyLine(nextTrimmed)) {
        blocks.push({ type: 'couplet', chordRow: line, lyricRow: nextLine }); i += 2; continue
      }
      // Chord line with no lyric beneath
      blocks.push({ type: 'couplet', chordRow: line, lyricRow: '' }); i++; continue
    }

    // Plain lyric / notes line
    blocks.push({ type: 'lyric', text: line }); i++
  }

  return (
    <div style={{ fontFamily:MONO, fontSize, overflowX:'auto' }}>
      {blocks.map((block, idx) => {
        if (block.type === 'gap') return <div key={idx} style={{ height:'0.75em' }} />
        if (block.type === 'section') return (
          <div key={idx} style={{ color:'#5a5a5a', fontSize: fontSize * 0.8, marginTop: idx > 0 ? 16 : 0, marginBottom:5, textTransform:'uppercase', letterSpacing:'0.15em', fontFamily:'Inter, sans-serif', fontWeight:500, textAlign: centerSections ? 'center' : 'left' }}>
            {block.text}
          </div>
        )
        if (block.type === 'couplet') return (
          <div key={idx} style={{ marginBottom:14 }}>
            <div style={{ color:GOLD, whiteSpace:'pre-wrap', fontWeight:600, lineHeight:1.3, fontSize }}>{block.chordRow || '\u200B'}</div>
            <div style={{ color:'#e3e0da', whiteSpace:'pre-wrap', lineHeight:1.6, fontSize }}>{block.lyricRow || '\u200B'}</div>
          </div>
        )
        // lyric
        return <div key={idx} style={{ color:'#999', whiteSpace:'pre-wrap', lineHeight:1.6, marginBottom:2, fontSize }}>{block.text}</div>
      })}
    </div>
  )
}

function parseChordResponse(text) {
  if (!text) return { parseFailed: true }
  let t = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim()
  // Strip a code fence if the model wrapped the whole answer in one.
  t = t.replace(/^```[a-zA-Z]*\n?/, '').replace(/\n?```$/, '').trim()
  if (/^UNKNOWN[.!]?$/i.test(t)) return { unknown: true }

  const tempoMatch = t.match(/^TEMPO:\s*(.+)/im)
  const notesMatch = t.match(/^NOTES:\s*(.+)/im)
  const keyMatch   = t.match(/^KEY:\s*(.+)/im)
  // Accept the chart on the same line OR the next line after the label.
  const chordsLyricsMatch = t.match(/^CHORDS_LYRICS:\s*([\s\S]+)/im)
  const chordsMatch       = t.match(/^CHORDS:\s*([\s\S]+)/im)

  const result = {}
  if (tempoMatch) result.tempo = tempoMatch[1].trim()
  if (notesMatch) result.notes = notesMatch[1].trim()
  if (keyMatch)   result.key   = keyMatch[1].trim()
  if (chordsLyricsMatch)      result.chords = chordsLyricsMatch[1].trim()
  else if (chordsMatch)       result.chords = chordsMatch[1].trim()
  else if (!tempoMatch && !notesMatch && !keyMatch) {
    // No markers at all: only treat as a chart if it actually looks like one
    // ([Am]-style tokens or multi-line) — never dump stray prose into chords.
    if (/\[[A-G][#b]?/.test(t) || t.includes('\n')) result.chords = t
  }

  if (!result.chords) result.parseFailed = true
  return result
}

// Human-readable reason for a failed/empty chord fill.
function chordErrorMsg(reason, err) {
  switch (reason) {
    case 'quota':   return err || 'Web-search quota exceeded for today. Try again tomorrow.'
    case 'rate':    return err || 'Claude is busy right now. Wait a moment and try again.'
    case 'unknown': return "Claude doesn't know this exact song. Enter chords manually or try Google."
    case 'parse':   return 'Got a reply but could not read the chords from it. Try again.'
    case 'network': return 'Network error. Check your connection and try again.'
    default:        return err || 'Chord fill failed. Try again.'
  }
}

// Shared chord fetcher: Claude first (training knowledge, no quota), then an
// optional Gemini web-search fallback. Returns { reason, chords?, tempo?, notes?,
// key?, source?, error? }; reason === 'ok' on success.
async function fetchChordData({ name, artist, key }, { allowWebFallback = true } = {}) {
  const req = {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ songName: name, artist, key }),
  }

  // 1) Claude — knowledge-based, won't burn the Gemini quota.
  let claudeUnknown = false
  try {
    const res = await fetch('/api/claude', req)
    const data = await res.json()
    if (res.ok) {
      const parsed = parseChordResponse(data.text || '')
      if (parsed.chords) return { ...parsed, reason: 'ok', source: 'claude' }
      if (parsed.unknown) claudeUnknown = true
    } else if (res.status === 429) {
      return { reason: 'rate', error: data.error }
    } else if (!allowWebFallback) {
      return { reason: 'error', error: data.error }
    }
  } catch (e) {
    if (!allowWebFallback) return { reason: 'network' }
  }

  // 2) Gemini web-search fallback — single fills only (costs quota).
  if (!allowWebFallback) return { reason: claudeUnknown ? 'unknown' : 'parse' }
  try {
    const res = await fetch('/api/chords', req)
    const data = await res.json()
    if (!res.ok) return { reason: res.status === 429 ? 'quota' : 'error', error: data.error }
    const parsed = parseChordResponse(data.text || '')
    if (parsed.chords) return { ...parsed, reason: 'ok', source: 'gemini' }
    if (parsed.unknown) return { reason: 'unknown' }
    return { reason: 'parse' }
  } catch (e) {
    return { reason: 'network' }
  }
}

// Alphabetical grouping helpers
function getSortName(name) {
  return name.replace(/^(the|a|an)\s+/i, '').trim()
}
function getAlphaKey(name) {
  const first = getSortName(name)[0]?.toUpperCase() || '#'
  return /[A-Z]/.test(first) ? first : '#'
}
function groupAlphabetically(songs) {
  const sorted = [...songs].sort((a, b) =>
    getSortName(a.name).toLowerCase().localeCompare(getSortName(b.name).toLowerCase())
  )
  const groups = []
  let curLetter = null
  sorted.forEach(song => {
    const letter = getAlphaKey(song.name)
    if (letter !== curLetter) { curLetter = letter; groups.push({ letter, songs: [] }) }
    groups[groups.length - 1].songs.push(song)
  })
  return groups
}

const TABS = [
  { id:'songs',     icon:'♪', label:'Songs'   },
  { id:'gig',       icon:'▶', label:'Gig'     },
  { id:'keyfinder', icon:'♯', label:'Key'     },
  { id:'setlist',   icon:'≡', label:'Setlist' },
]

// Tick-mark label: mono, uppercase, wide tracking, dim — used for all section headers.
const tick = (extra = {}) => ({
  fontFamily:MONO, fontWeight:700, fontSize:9, color:DIM,
  letterSpacing:'0.2em', textTransform:'uppercase', ...extra,
})

const s = {
  app: { display:'flex', flexDirection:'column', height:'100dvh', background:BG, overflow:'hidden' },
  header: { padding:'0 22px 0', paddingTop:'calc(env(safe-area-inset-top) + 22px)', background:BG, flexShrink:0, borderBottom:`1px solid ${HAIR}` },
  scroll: { flex:1, overflowY:'auto', WebkitOverflowScrolling:'touch', paddingBottom:'calc(96px + env(safe-area-inset-bottom))', overflowX:'hidden' },
  // Large-title (iOS-style) header block, uppercase, gold square tick.
  largeTitle: { display:'flex', alignItems:'center', gap:8, marginBottom:18 },
  largeTitleSquare: { width:9, height:9, background:GOLD, flexShrink:0 },
  largeTitleText: { font:`700 34px ${DISPLAY}`, color:TXT, letterSpacing:'-0.01em', textTransform:'uppercase' },
  bottomNav: {
    position:'fixed', bottom:0, left:0, right:0,
    background:'rgba(13,13,15,0.82)',
    backdropFilter:'blur(20px) saturate(160%)',
    WebkitBackdropFilter:'blur(20px) saturate(160%)',
    borderTop:'1px solid rgba(255,255,255,0.06)',
    display:'flex', padding:'10px 12px', paddingBottom:'calc(8px + env(safe-area-inset-bottom))',
    zIndex:100,
  },
  navBtn: () => ({
    flex:1, display:'flex', flexDirection:'column', alignItems:'center',
    gap:4, padding:0, background:'none', border:'none', cursor:'pointer',
  }),
  navIcon: (active) => ({ fontSize:19, lineHeight:1, color: active ? GOLD : DIM }),
  navLabel: (active) => ({ font:`600 9px ${MONO}`, letterSpacing:'0.1em', color: active ? GOLD : DIM }),
  // Search field — one of the few rounded elements (rack chrome).
  searchWrap: { background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.06)', borderRadius:12, padding:'12px 16px', marginBottom:16 },
  searchInput: { width:'100%', background:'transparent', border:'none', outline:'none', color:TXT, fontSize:13, fontFamily:'Inter, sans-serif', display:'block' },
  // Two-way segmented filter with sliding highlight pill.
  segTrack: { position:'relative', display:'flex', background:'rgba(255,255,255,0.04)', borderRadius:10, padding:3 },
  segPill: (shift) => ({ position:'absolute', top:3, bottom:3, left:3, width:'calc(50% - 3px)', background:'#1c1c20', border:`1px solid ${GOLD_DIM}`, borderRadius:7, transition:'transform 0.4s cubic-bezier(0.34,1.56,0.64,1)', transform:`translateX(${shift})` }),
  segOpt: (active) => ({ flex:1, position:'relative', zIndex:1, textAlign:'center', padding:'9px 0', cursor:'pointer', font:`600 12px ${MONO}`, letterSpacing:'0.08em', color: active ? TXT : DIM }),
  // Hairline song row + expandable detail (grid-rows animation).
  row: { borderTop:`1px solid ${HAIR}` },
  rowHead: { display:'flex', alignItems:'center', justifyContent:'space-between', padding:'16px 2px', cursor:'pointer' },
  rowDot: (has) => ({ width:6, height:6, background: has ? GOLD : 'rgba(255,255,255,0.15)', flexShrink:0 }),
  rowName: { font:`500 18px ${DISPLAY}`, color:TXT, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' },
  rowArtist: { font:`400 12px 'Inter',sans-serif`, color:TXT3, marginTop:2 },
  rowKey: { color:GOLD, font:`700 13px ${MONO}` },
  star: (fav) => ({ color: fav ? GOLD : 'rgba(255,255,255,0.12)', fontSize:15, background:'none', border:'none', cursor:'pointer', padding:0, lineHeight:1 }),
  expandWrap: (open) => ({ display:'grid', gridTemplateRows: open ? '1fr' : '0fr', transition:'grid-template-rows 0.45s cubic-bezier(0.34,1.56,0.64,1)' }),
  groupLetter: { font:`700 11px ${MONO}`, color:DIM, letterSpacing:'0.2em', margin:'18px 0 6px' },
  keyBadge: { background:'rgba(199,178,122,0.07)', color:GOLD, border:`1px solid rgba(199,178,122,0.18)`, borderRadius:0, fontSize:11, fontWeight:700, padding:'4px 10px', fontFamily:MONO, letterSpacing:'0.06em' },
  evPill: (ev) => {
    const c = EVENT_COLORS[ev] || EVENT_COLORS.all
    return { background:c.bg, color:c.text, border:`1px solid ${c.border}`, borderRadius:0, fontSize:9, fontWeight:700, padding:'2px 8px', letterSpacing:'0.1em', textTransform:'uppercase', fontFamily:MONO }
  },
  // Inset chord-chart / detail panel.
  panel: { background:PANEL, borderRadius:8, padding:'12px 14px' },
  detailGrid: { display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, marginBottom:14, width:'100%', boxSizing:'border-box' },
  fieldLabel: tick({ display:'block', marginBottom:7, letterSpacing:'0.18em' }),
  fieldSelect: { width:'100%', padding:'10px 11px', background:'#0f0f11', border:`1px solid ${HAIR}`, borderRadius:0, color:TXT, fontSize:13, boxSizing:'border-box', fontFamily:'Inter, sans-serif' },
  fieldInput: { width:'100%', padding:'10px 11px', background:'#0f0f11', border:`1px solid ${HAIR}`, borderRadius:0, color:TXT, fontSize:13, boxSizing:'border-box', fontFamily:'Inter, sans-serif' },
  fieldTextarea: { width:'100%', padding:'10px 11px', background:'#0f0f11', border:`1px solid ${HAIR}`, borderRadius:0, color:TXT, fontSize:13, resize:'vertical', fontFamily:'inherit', boxSizing:'border-box' },
  chordBox: { width:'100%', padding:'11px 13px', background:'#0a0a0c', border:`1px solid ${GOLD_DIM}`, borderRadius:0, color:GOLD, fontSize:13, fontFamily:MONO, resize:'vertical', minHeight:64, boxSizing:'border-box' },
  deleteBtn: { padding:'7px 14px', background:'none', border:`1px solid ${RED}`, borderRadius:0, color:RED, fontSize:11, cursor:'pointer', fontFamily:MONO, letterSpacing:'0.04em', textTransform:'uppercase' },
  kfCard: { margin:'0 0 24px', background:PANEL, border:`1px solid ${HAIR}`, borderRadius:8, padding:20 },
  kfLabel: tick({ marginBottom:14, letterSpacing:'0.18em' }),
  kfRow: { display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 },
  kfRowLabel: { fontSize:14, color:TXT2, fontFamily:'Inter, sans-serif' },
  kfSelect: { padding:'9px 11px', background:'#0f0f11', border:`1px solid ${HAIR}`, borderRadius:0, color:TXT, fontSize:13, maxWidth:180, fontFamily:'Inter, sans-serif' },
  kfResult: { background:PANEL, border:`1px solid ${GOLD_DIM}`, borderRadius:8, padding:'32px 28px 28px', textAlign:'center', marginBottom:24 },
  kfResultKey: { fontSize:88, fontWeight:700, color:GOLD, lineHeight:1, letterSpacing:'-0.03em', fontFamily:DISPLAY },
  kfResultSub: tick({ marginTop:12, letterSpacing:'0.18em' }),
  kfAlts: { display:'flex', gap:1, justifyContent:'center', marginTop:16, flexWrap:'wrap' },
  kfAlt: { padding:'7px 18px', border:`1px solid ${GOLD_DIM}`, color:GOLD, fontSize:13, background:'rgba(199,178,122,0.05)', fontFamily:MONO },
  runBtn: { width:'100%', margin:'0 0 24px', padding:16, background:GOLD, border:'none', borderRadius:0, color:'#000', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:MONO, letterSpacing:'0.1em', textTransform:'uppercase' },
  // Grouped (seamed) transport control: 1px-gap grid on SEAM background.
  seamStrip: { display:'flex', alignItems:'stretch', gap:1, background:SEAM, padding:1, borderRadius:10, overflow:'hidden' },
  seamCell: { flex:1, background:BG, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer' },
  empty: { textAlign:'center', padding:'72px 28px', color:DIM, fontSize:14, fontFamily:'Inter, sans-serif', lineHeight:2 },
}

function GigMode({ songs, onExit, onSaveKey }) {
  const [idx, setIdx] = useState(0)
  const [offset, setOffset] = useState(0)
  const [keySaved, setKeySaved] = useState(false)
  const [fontSize, setFontSize] = useState(() => {
    const saved = parseInt(localStorage.getItem('corda_gig_fontsize'))
    return saved >= 12 && saved <= 30 ? saved : 17
  })
  const [showJump, setShowJump] = useState(false)
  const touchStart = useRef(null)

  // Wake lock — acquire on mount and re-acquire after visibility change
  useEffect(() => {
    let wl = null
    async function acquire() {
      try { wl = await navigator.wakeLock?.request('screen') } catch {}
    }
    acquire()
    function onVisible() { if (document.visibilityState === 'visible') acquire() }
    document.addEventListener('visibilitychange', onVisible)
    return () => { document.removeEventListener('visibilitychange', onVisible); wl?.release() }
  }, [])

  useEffect(() => { setOffset(0); setKeySaved(false) }, [idx])

  // Keyboard navigation
  useEffect(() => {
    function onKey(e) {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp')   setIdx(i => Math.max(0, i - 1))
      else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') setIdx(i => Math.min(songs.length - 1, i + 1))
      else if (e.key === 'Escape') onExit()
      else if (e.key === '+' || e.key === '=') setOffset(o => o + 1)
      else if (e.key === '-' || e.key === '_') setOffset(o => o - 1)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [songs.length, onExit])

  if (!songs.length) return (
    <div style={{ position:'fixed', inset:0, background:'#0d0d0f', zIndex:200, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center' }}>
      <div style={{ fontSize:15, marginBottom:24, fontFamily:'Inter, sans-serif', color:'#555' }}>No songs to show</div>
      <button onClick={onExit} style={{ background:'none', border:`1px solid ${GOLD_DIM}`, borderRadius:4, color:GOLD, fontSize:14, padding:'10px 24px', cursor:'pointer', fontFamily:'Inter, sans-serif' }}>Exit</button>
    </div>
  )

  const song = songs[Math.min(idx, songs.length - 1)]
  const displayKey = transposeKey(song.key, offset)
  const displayChords = song.chords ? transposeChordText(song.chords, offset) : null

  function prev() { if (idx > 0) setIdx(i => i - 1) }
  function next() { if (idx < songs.length - 1) setIdx(i => i + 1) }

  // Swipe: only trigger on predominantly horizontal swipes
  function onTouchStart(e) {
    touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
  }
  function onTouchEnd(e) {
    if (!touchStart.current) return
    const dx = e.changedTouches[0].clientX - touchStart.current.x
    const dy = e.changedTouches[0].clientY - touchStart.current.y
    touchStart.current = null
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 60) {
      if (dx > 0) prev(); else next()
    }
  }

  async function saveKey() {
    await onSaveKey(song.id, displayKey)
    setKeySaved(true)
    setTimeout(() => setKeySaved(false), 2000)
  }

  const atStart = idx === 0
  const atEnd = idx === songs.length - 1

  return (
    <div
      style={{ position:'fixed', inset:0, background:'#0d0d0f', zIndex:200, display:'flex', flexDirection:'column', color:'#EDEBE6', userSelect:'none' }}
      onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}
    >
      {/* Top: track readout + seamed transpose strip */}
      <div style={{ flexShrink:0, padding:'0 20px', paddingTop:'calc(env(safe-area-inset-top) + 12px)' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
          <button onClick={() => setShowJump(true)} style={{ background:'none', border:'none', cursor:'pointer', padding:0 }}>
            <span style={{ color:TXT3, font:`400 10px ${MONO}`, letterSpacing:'0.16em' }}>TRK {idx + 1}/{songs.length}{songs.length > 1 ? '  ≡' : ''}</span>
          </button>
          <div style={{ display:'flex', alignItems:'center', gap:14 }}>
            <span style={{ color:DIM, font:`400 10px ${MONO}`, letterSpacing:'0.16em' }}>GIG MODE</span>
            <button onClick={onExit} style={{ background:'none', border:'none', color:DIM, fontSize:14, cursor:'pointer', padding:0, lineHeight:1 }}>✕</button>
          </div>
        </div>

        <div style={s.seamStrip}>
          <div className="press" style={{ ...s.seamCell, padding:'14px 0' }} onClick={() => setOffset(o => o - 1)}>
            <span style={{ color:GOLD, fontSize:20, fontFamily:MONO }}>−</span>
          </div>
          <div style={{ ...s.seamCell, flex:2, flexDirection:'column', padding:'10px 0', cursor:'default' }}>
            <span style={{ color:DIM, font:`400 8px ${MONO}`, letterSpacing:'0.22em', marginBottom:3 }}>KEY</span>
            <span key={offset} style={{ color:GOLD, fontSize:30, fontWeight:700, fontFamily:DISPLAY, letterSpacing:'-0.01em', animation:'keyPop 0.32s cubic-bezier(0.34,1.56,0.64,1)' }}>{displayKey || '—'}</span>
          </div>
          <div className="press" style={{ ...s.seamCell, padding:'14px 0' }} onClick={() => setOffset(o => o + 1)}>
            <span style={{ color:GOLD, fontSize:20, fontFamily:MONO }}>+</span>
          </div>
        </div>

        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', minHeight:26, marginTop:8 }}>
          <span style={{ color:DIM, font:`400 10px ${MONO}`, letterSpacing:'0.06em' }}>{offset !== 0 ? `${offset > 0 ? '+' : ''}${offset} ST` : ''}</span>
          <button onClick={saveKey} disabled={!displayKey || !offset}
            style={{ background:'none', border:`1px solid ${keySaved ? '#3a5a3a' : (offset ? GOLD_DIM : HAIR)}`, borderRadius:0, color: keySaved ? '#7aa87a' : (offset ? GOLD : DISABLED), font:`700 9px ${MONO}`, letterSpacing:'0.1em', padding:'5px 12px', cursor: offset ? 'pointer' : 'default', textTransform:'uppercase' }}>
            {keySaved ? 'Saved ✓' : 'Save Key'}
          </button>
        </div>
      </div>

      {/* Scrollable content */}
      <div key={song.id} style={{ flex:1, overflowY:'auto', overflowX:'hidden', WebkitOverflowScrolling:'touch', padding:'26px 24px 36px' }} className="gig-song">
        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
          <div style={{ width:8, height:8, background:GOLD, flexShrink:0 }} />
          <div style={{ font:`700 ${song.name.length > 22 ? '24px' : '30px'}/1.1 ${DISPLAY}`, color:TXT, letterSpacing:'-0.01em', textTransform:'uppercase' }}>{song.name}</div>
        </div>
        <div style={{ font:`400 11px ${MONO}`, color:TXT3, letterSpacing:'0.05em', marginBottom:22, paddingLeft:16, textTransform:'uppercase' }}>
          {[song.artist, song.patch].filter(Boolean).join(' — ') || ' '}
        </div>

        {displayChords
          ? <div style={{ marginBottom:28, borderTop:`1px solid ${SEAM}`, paddingTop:14 }} className="gig-chords">
              <ChordLyricDisplay text={displayChords} fontSize={fontSize} />
            </div>
          : <div style={{ color:DIM, fontSize:14, fontFamily:'Inter, sans-serif', marginBottom:28, borderTop:`1px solid ${SEAM}`, paddingTop:16 }}>No chord chart — add chords from the Songs tab.</div>
        }

        {song.notes && (
          <div style={{ color:TXT3, fontSize:13, lineHeight:1.75, borderTop:`1px solid ${SEAM}`, paddingTop:18, fontFamily:'Inter, sans-serif' }}>{song.notes}</div>
        )}
      </div>

      {/* Jump-to-song overlay (large sets) */}
      {showJump && (
        <div onClick={() => setShowJump(false)}
          style={{ position:'absolute', inset:0, background:'rgba(0,0,0,0.94)', zIndex:10, display:'flex', flexDirection:'column', paddingTop:'env(safe-area-inset-top)' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'14px 18px 10px', flexShrink:0, borderBottom:'1px solid #161616' }}>
            <span style={{ color:'#5a5a5a', fontSize:9, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.2em', fontFamily:'Inter, sans-serif' }}>Song list</span>
            <button onClick={() => setShowJump(false)} style={{ background:'none', border:'none', color:'#5a5a5a', fontSize:22, cursor:'pointer', padding:'0 2px', lineHeight:1 }}>✕</button>
          </div>
          <div style={{ overflowY:'auto', flex:1, WebkitOverflowScrolling:'touch' }} onClick={e => e.stopPropagation()}>
            {songs.map((sg, i) => (
              <div key={sg.id}
                onClick={() => { setIdx(i); setOffset(0); setShowJump(false) }}
                style={{ display:'flex', alignItems:'center', gap:14, padding:'13px 18px', borderBottom:'1px solid #141414', background: i === idx ? 'rgba(199,178,122,0.06)' : 'transparent', cursor:'pointer' }}>
                <span style={{ color:'#333', fontSize:11, fontVariantNumeric:'tabular-nums', minWidth:22, textAlign:'right', fontFamily:'Inter, sans-serif', flexShrink:0 }}>{i + 1}</span>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:16, color: i === idx ? GOLD : '#EDEBE6', fontFamily:'Space Grotesk, sans-serif', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', fontWeight: i === idx ? 600 : 400 }}>{sg.name}</div>
                  {sg.artist && <div style={{ fontSize:11, color:'#5a5a5a', fontFamily:'Inter, sans-serif', marginTop:2 }}>{sg.artist}</div>}
                </div>
                {sg.key && <span style={s.keyBadge}>{sg.key}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Bottom: seamed prev / tempo+font-size / next strip */}
      <div style={{ flexShrink:0, ...s.seamStrip, margin:'0 20px', marginBottom:'calc(18px + env(safe-area-inset-bottom))' }}>
        <div className="press" style={{ ...s.seamCell, padding:'12px 0', cursor: atStart ? 'default' : 'pointer' }} onClick={atStart ? undefined : prev}>
          <span style={{ color: atStart ? DISABLED : GOLD, fontSize:20, fontFamily:MONO }}>‹</span>
        </div>
        <div style={{ ...s.seamCell, flex:2, flexDirection:'column', gap:4, padding:'8px 12px', cursor:'default' }}>
          {(song.tempo || song.bpm) && (
            <span style={{ color:DIM, font:`400 9px ${MONO}`, letterSpacing:'0.1em', textTransform:'uppercase', textAlign:'center', lineHeight:1.4 }}>
              {song.tempo || ''}{song.bpm && song.tempo ? ' · ' : ''}{song.bpm ? `${song.bpm}BPM` : ''}
            </span>
          )}
          <div style={{ display:'flex', gap:16 }}>
            <span onClick={() => setFontSize(f => { const n = Math.max(12, f - 2); localStorage.setItem('corda_gig_fontsize', n); return n })}
              style={{ color:DIM, fontSize:13, fontFamily:MONO, cursor:'pointer' }}>A−</span>
            <span onClick={() => setFontSize(f => { const n = Math.min(30, f + 2); localStorage.setItem('corda_gig_fontsize', n); return n })}
              style={{ color:DIM, fontSize:13, fontFamily:MONO, cursor:'pointer' }}>A+</span>
          </div>
        </div>
        <div className="press" style={{ ...s.seamCell, padding:'12px 0', cursor: atEnd ? 'default' : 'pointer' }} onClick={atEnd ? undefined : next}>
          <span style={{ color: atEnd ? DISABLED : GOLD, fontSize:20, fontFamily:MONO }}>›</span>
        </div>
      </div>
    </div>
  )
}

function SetListBuilder({ songs: allSongs, onPlay }) {
  const [setlists, setSetlists] = useState([])
  const [active, setActive] = useState(null)
  const [slots, setSlots] = useState([])
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [newEvent, setNewEvent] = useState('kumzitz')
  const [newDate, setNewDate] = useState('')
  const [songSearch, setSongSearch] = useState('')
  const [deleteConfirmSlId, setDeleteConfirmSlId] = useState(null)
  const [editingSlName, setEditingSlName] = useState(false)

  useEffect(() => { fetchSetlists() }, [])

  async function fetchSetlists() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSetlists([]); return }
    const { data } = await supabase.from('setlists').select('*, setlist_songs(id)').eq('user_id', user.id).order('created_at', { ascending: false })
    setSetlists(data || [])
  }

  function fmtDate(d) {
    if (!d) return ''
    const [y, m, day] = d.split('-')
    return new Date(+y, +m - 1, +day).toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' })
  }

  async function renameSetlist(newName) {
    const trimmed = newName.trim()
    setEditingSlName(false)
    if (!trimmed || trimmed === active.name) return
    await supabase.from('setlists').update({ name: trimmed }).eq('id', active.id)
    setActive(prev => ({ ...prev, name: trimmed }))
  }

  async function openSetlist(sl) {
    setActive(sl)
    setLoadingSlots(true)
    setSlots([])
    setSongSearch('')
    setEditingSlName(false)
    const { data } = await supabase.from('setlist_songs').select('*, songs(*)').eq('setlist_id', sl.id).order('position')
    setSlots(data || [])
    setLoadingSlots(false)
  }

  async function createSetlist() {
    if (!newName.trim()) return
    const { data: { user } } = await supabase.auth.getUser()
    const { data, error } = await supabase.from('setlists')
      .insert({ name: newName.trim(), event_type: newEvent, event_date: newDate || null, user_id: user?.id })
      .select().single()
    if (!error) {
      setCreating(false); setNewName(''); setNewDate('')
      await fetchSetlists()
      openSetlist(data)
    }
  }

  async function deleteSetlist(id, e) {
    e.stopPropagation()
    await supabase.from('setlist_songs').delete().eq('setlist_id', id)
    await supabase.from('setlists').delete().eq('id', id)
    setSetlists(prev => prev.filter(s => s.id !== id))
  }

  async function addSong(song) {
    const { data, error } = await supabase.from('setlist_songs')
      .insert({ setlist_id: active.id, song_id: song.id, position: slots.length })
      .select('*, songs(*)').single()
    if (!error) { setSlots(prev => [...prev, data]); setSongSearch('') }
  }

  async function removeSong(slotId) {
    await supabase.from('setlist_songs').delete().eq('id', slotId)
    const next = slots.filter(s => s.id !== slotId)
    setSlots(next)
    await Promise.all(next.map((s, i) => supabase.from('setlist_songs').update({ position: i }).eq('id', s.id)))
  }

  // Reorder via explicit up/down controls (no drag lib) — simplest cross-platform port.
  async function reorder(fromIdx, toIdx) {
    if (fromIdx === toIdx || toIdx == null || toIdx < 0 || toIdx >= slots.length) return
    const next = [...slots]
    const [moved] = next.splice(fromIdx, 1)
    next.splice(toIdx, 0, moved)
    setSlots(next)
    await Promise.all(next.map((s, i) => supabase.from('setlist_songs').update({ position: i }).eq('id', s.id)))
  }

  const alreadyInSet = new Set(slots.map(sl => sl.song_id))
  const filteredSongs = songSearch.trim()
    ? allSongs.filter(s =>
        !alreadyInSet.has(s.id) &&
        (s.name.toLowerCase().includes(songSearch.toLowerCase()) ||
         (s.artist||'').toLowerCase().includes(songSearch.toLowerCase()))
      ).slice(0, 6)
    : []

  const slotSongs = slots.map(sl => sl.songs).filter(Boolean)

  if (!active) return (
    <div style={{ padding:'6px 22px', paddingBottom:'calc(90px + env(safe-area-inset-bottom))' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', ...s.largeTitle }}>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <div style={s.largeTitleSquare} />
          <div style={s.largeTitleText}>Setlist</div>
        </div>
        <button onClick={() => setCreating(true)}
          style={{ background:'transparent', border:`1px solid ${GOLD_DIM}`, borderRadius:0, color:GOLD, font:`700 10px ${MONO}`, padding:'7px 14px', cursor:'pointer', letterSpacing:'0.12em' }}>+ NEW</button>
      </div>

      {creating && (
        <div style={{ background:'#111', border:'1px solid #1e1e1e', borderRadius:14, padding:16, marginBottom:12 }}>
          <input autoFocus placeholder="Set list name..." value={newName}
            onChange={e => setNewName(e.target.value)} onKeyDown={e => e.key === 'Enter' && createSetlist()}
            className="focus-gold"
            style={{ width:'100%', padding:'10px 12px', background:'#111', border:'1px solid #1e1e1e', borderRadius:7, color:'#EDEBE6', fontSize:14, boxSizing:'border-box', marginBottom:10, outline:'none', fontFamily:'Inter, sans-serif' }}
            autoCorrect="off" autoCapitalize="words" spellCheck={false} />
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:10 }}>
            <select value={newEvent} onChange={e => setNewEvent(e.target.value)}
              style={{ padding:'9px 10px', background:'#111', border:'1px solid #1e1e1e', borderRadius:7, color:'#EDEBE6', fontSize:13, boxSizing:'border-box', fontFamily:'Inter, sans-serif' }}>
              <option value="kumzitz">Kumzitz</option>
              <option value="sheva">Sheva Brachos</option>
              <option value="wedding">Wedding</option>
              <option value="all">All events</option>
            </select>
            <input type="date" value={newDate} onChange={e => setNewDate(e.target.value)}
              style={{ padding:'9px 10px', background:'#0d0d0d', border:'1px solid #1e1e1e', borderRadius:7, color:'#EDEBE6', fontSize:13, boxSizing:'border-box', colorScheme:'dark', fontFamily:'Inter, sans-serif' }} />
          </div>
          <div style={{ display:'flex', gap:8 }}>
            <button onClick={createSetlist} disabled={!newName.trim()}
              style={{ flex:1, padding:'10px 0', background: newName.trim() ? GOLD : '#181818', border:'none', borderRadius:7, color: newName.trim() ? '#000' : '#3a3a3a', fontSize:13, fontWeight:700, cursor: newName.trim() ? 'pointer' : 'default', fontFamily:'Inter, sans-serif', letterSpacing:'0.04em' }}>Create</button>
            <button onClick={() => { setCreating(false); setNewName('') }}
              style={{ padding:'10px 14px', background:'none', border:'1px solid #1e1e1e', borderRadius:7, color:'#555', fontSize:13, cursor:'pointer', fontFamily:'Inter, sans-serif' }}>Cancel</button>
          </div>
        </div>
      )}

      {setlists.length === 0 && !creating && (
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:12, padding:'120px 20px', textAlign:'center' }}>
          <div style={{ width:10, height:10, background:SEAM }} />
          <div style={{ color:TXT3, font:`700 11px ${MONO}`, letterSpacing:'0.16em', textTransform:'uppercase' }}>No setlists yet</div>
          <div style={{ color:DIM, fontSize:13, fontFamily:'Inter, sans-serif' }}>Tap + NEW to build your first setlist.</div>
        </div>
      )}
      {setlists.map(sl => (
        <div key={sl.id} onClick={() => { setDeleteConfirmSlId(null); openSetlist(sl) }}
          className="press"
          style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'16px 2px', borderTop:`1px solid ${HAIR}`, cursor:'pointer' }}>
          <div style={{ display:'flex', alignItems:'center', gap:10, minWidth:0, flex:1 }}>
            <div style={{ width:6, height:6, background:GOLD, flexShrink:0 }} />
            <div style={{ minWidth:0 }}>
              <div style={{ font:`500 16px ${DISPLAY}`, color:TXT, marginBottom:3, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{sl.name}</div>
              <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
                <span style={s.evPill(sl.event_type)}>
                  {sl.event_type === 'sheva' ? 'SB' : sl.event_type === 'kumzitz' ? 'KZ' : sl.event_type === 'wedding' ? 'WD' : 'ALL'}
                </span>
                {sl.event_date && <span style={{ font:`400 11px ${MONO}`, color:TXT3 }}>{fmtDate(sl.event_date)}</span>}
                <span style={{ font:`400 11px ${MONO}`, color:TXT3 }}>{sl.setlist_songs?.length || 0} TRK</span>
              </div>
            </div>
          </div>
          {deleteConfirmSlId === sl.id
            ? <div style={{ display:'flex', gap:5, alignItems:'center', flexShrink:0 }} onClick={e => e.stopPropagation()}>
                <button onClick={e => { deleteSetlist(sl.id, e); setDeleteConfirmSlId(null) }}
                  style={{ background:'none', border:`1px solid ${RED}`, borderRadius:0, color:RED, font:`700 10px ${MONO}`, padding:'4px 9px', cursor:'pointer', letterSpacing:'0.08em' }}>DELETE</button>
                <button onClick={e => { e.stopPropagation(); setDeleteConfirmSlId(null) }}
                  style={{ background:'none', border:`1px solid ${HAIR}`, borderRadius:0, color:DIM, font:`700 10px ${MONO}`, padding:'4px 8px', cursor:'pointer' }}>NO</button>
              </div>
            : <button onClick={e => { e.stopPropagation(); setDeleteConfirmSlId(sl.id) }}
                style={{ background:'none', border:'none', color:DIM, fontSize:16, cursor:'pointer', padding:'0 4px', lineHeight:1, flexShrink:0, fontFamily:MONO }}>✕</button>
          }
        </div>
      ))}
    </div>
  )

  return (
    <div style={{ position:'fixed', inset:0, background:'#0d0d0f', zIndex:150, display:'flex', flexDirection:'column' }}>
      <div style={{ padding:'10px 14px 10px', paddingTop:'calc(env(safe-area-inset-top) + 10px)', borderBottom:'1px solid #141414', flexShrink:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:6 }}>
          <button onClick={() => { setActive(null); fetchSetlists() }}
            style={{ background:'none', border:'none', color:GOLD, fontSize:24, cursor:'pointer', padding:'2px 0', lineHeight:1 }}>‹</button>
          {editingSlName
            ? <input autoFocus defaultValue={active.name}
                onBlur={e => renameSetlist(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') e.target.blur(); if (e.key === 'Escape') setEditingSlName(false) }}
                style={{ flex:1, background:'transparent', border:'none', borderBottom:`1px solid rgba(199,178,122,0.22)`, color:'#EDEBE6', fontSize:17, fontFamily:'Space Grotesk, sans-serif', fontWeight:500, padding:'0 0 2px', outline:'none', minWidth:0 }}
              />
            : <div onClick={() => setEditingSlName(true)} title="Tap to rename"
                style={{ flex:1, fontSize:17, fontWeight:500, color:'#EDEBE6', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', fontFamily:'Space Grotesk, sans-serif', cursor:'text', letterSpacing:'-0.01em' }}>
                {active.name}
              </div>
          }
          <button onClick={() => onPlay(slotSongs)} disabled={slotSongs.length === 0}
            style={{ background: slotSongs.length ? GOLD : 'transparent', border:`1px solid ${slotSongs.length ? GOLD : '#1c1c1c'}`, borderRadius:6, color: slotSongs.length ? '#000' : '#3a3a3a', fontSize:12, fontWeight:700, padding:'7px 14px', cursor: slotSongs.length ? 'pointer' : 'default', flexShrink:0, fontFamily:'Inter, sans-serif', letterSpacing:'0.04em' }}>
            ▶ Play
          </button>
        </div>
        <div style={{ display:'flex', gap:6, alignItems:'center', paddingLeft:34 }}>
          <span style={s.evPill(active.event_type)}>
            {active.event_type === 'sheva' ? 'SB' : active.event_type === 'kumzitz' ? 'KZ' : active.event_type === 'wedding' ? 'WD' : 'ALL'}
          </span>
          {active.event_date && <span style={{ color:'#444', fontSize:11, fontFamily:'Inter, sans-serif' }}>{fmtDate(active.event_date)}</span>}
          <span style={{ color:'#444', fontSize:11, fontFamily:'Inter, sans-serif' }}>{slots.length} songs</span>
        </div>
      </div>

      <div style={{ flex:1, overflowY:'auto', WebkitOverflowScrolling:'touch' }}>
        <div style={{ padding:'12px 22px 32px' }}>
          <div style={tick({ margin:'0 0 10px' })}>ADD TO SETLIST</div>
          <div style={{ ...s.searchWrap, marginBottom: filteredSongs.length ? 0 : 16 }}>
            <input placeholder="Search songs to add…" value={songSearch}
              onChange={e => setSongSearch(e.target.value)}
              style={s.searchInput}
              autoCorrect="off" autoCapitalize="none" spellCheck={false} />
          </div>

          {filteredSongs.length > 0 && (
            <div style={{ marginBottom:16 }}>
              {filteredSongs.map(song => (
                <div key={song.id} onClick={() => addSong(song)} className="press"
                  style={{ padding:'12px 2px', display:'flex', justifyContent:'space-between', alignItems:'center', borderTop:`1px solid ${HAIR}`, cursor:'pointer' }}>
                  <div style={{ minWidth:0, flex:1 }}>
                    <div style={{ font:`500 14px ${DISPLAY}`, color:TXT2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{song.name}</div>
                    {song.artist && <div style={{ font:`400 11px 'Inter',sans-serif`, color:TXT3 }}>{song.artist}</div>}
                  </div>
                  <span style={{ color:GOLD, fontSize:15, lineHeight:1, flexShrink:0, marginLeft:8 }}>+</span>
                </div>
              ))}
            </div>
          )}

          {loadingSlots && (
            <div style={{ padding:'4px 0' }}>
              {[1,2,3].map(i => (
                <div key={i} className="skeleton" style={{ padding:'14px 2px', borderTop:`1px solid ${HAIR}`, opacity: 1 - i * 0.22 }}>
                  <div style={{ height:12, width:`${50 + i * 15}%`, background:'#26262b', marginBottom:7 }} />
                  <div style={{ height:9, width:`${28 + i * 10}%`, background:'#1c1c20' }} />
                </div>
              ))}
            </div>
          )}
          {!loadingSlots && slots.length === 0 && (
            <div style={{ color:DIM, textAlign:'center', padding:'44px 0', fontSize:13, fontFamily:'Inter, sans-serif', letterSpacing:'0.02em' }}>Search above to add songs.</div>
          )}
          {slots.length > 0 && <div style={tick({ margin:'8px 0 0' })}>TRACKS</div>}

          <div>
            {slots.map((slot, i) => {
              const song = slot.songs
              const atTop = i === 0
              const atBottom = i === slots.length - 1
              return (
                <div key={slot.id}
                  style={{ display:'flex', alignItems:'center', gap:12, padding:'14px 2px', borderTop:`1px solid ${HAIR}` }}>
                  <span style={{ font:`700 12px ${MONO}`, color:DIM, width:18, flexShrink:0 }}>{i + 1}</span>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ font:`500 16px ${DISPLAY}`, color:TXT, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{song?.name}</div>
                    <div style={{ font:`400 12px ${MONO}`, color:TXT3, marginTop:2 }}>
                      {[song?.key, song?.tempo].filter(Boolean).join(' · ') || (song?.artist || '')}
                      {song && !song.chords?.trim() && <span style={{ color:RED, marginLeft:6 }}>· NO CHART</span>}
                    </div>
                  </div>
                  <div style={{ display:'flex', gap:1, background:SEAM, overflow:'hidden', flexShrink:0 }}>
                    <div className="press" onClick={() => { if (!atTop) reorder(i, i - 1) }} style={{ background:BG, padding:'6px 9px', cursor: atTop ? 'default' : 'pointer' }}><span style={{ color: atTop ? DISABLED : GOLD, fontSize:12, fontFamily:MONO }}>▲</span></div>
                    <div className="press" onClick={() => { if (!atBottom) reorder(i, i + 1) }} style={{ background:BG, padding:'6px 9px', cursor: atBottom ? 'default' : 'pointer' }}><span style={{ color: atBottom ? DISABLED : GOLD, fontSize:12, fontFamily:MONO }}>▼</span></div>
                    <div className="press" onClick={() => removeSong(slot.id)} style={{ background:BG, padding:'6px 9px', cursor:'pointer' }}><span style={{ color:RED, fontSize:12, fontFamily:MONO }}>✕</span></div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

function inp2(extra = {}) {
  return { width:'100%', padding:'9px 10px', background:'#0f0f11', border:`1px solid ${HAIR}`, borderRadius:0, color:TXT, fontSize:13, boxSizing:'border-box', fontFamily:'Inter, sans-serif', outline:'none', ...extra }
}
// Uppercase mono field label used across the Add form.
const addLabel = { font:`700 9px 'Space Mono',monospace`, color:DIM, display:'block', marginBottom:6, textTransform:'uppercase', letterSpacing:'0.16em' }

function AddSongTab({ onSaved }) {
  const [name, setName] = useState('')
  const [artist, setArtist] = useState('')
  const [key, setKey] = useState('D')
  const [event, setEvent] = useState('kumzitz')
  const [patch, setPatch] = useState('Warm Grand Piano')
  const [chords, setChords] = useState('')
  const [notes, setNotes] = useState('')
  const [tempo, setTempo] = useState('')
  const [tags, setTags] = useState('')
  const [bpm, setBpm] = useState('')
  const [saving, setSaving] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const [addAiError, setAddAiError] = useState('')

  async function searchChords() {
    if (!name.trim()) return
    setAiLoading(true)
    setAddAiError('')
    try {
      const r = await fetchChordData({ name, artist, key }, { allowWebFallback: true })
      if (r.reason === 'ok') {
        if (r.tempo) setTempo(r.tempo)
        if (r.notes) setNotes(r.notes)
        if (r.chords) setChords(r.chords)
        if (r.key) setKey(r.key)
      } else {
        setAddAiError(chordErrorMsg(r.reason, r.error))
      }
    } catch(e) {
      setAddAiError('Network error. Check your connection and try again.')
      console.error(e)
    }
    setAiLoading(false)
  }

  async function save() {
    if (!name.trim()) return
    setSaving(true)

    let finalChords = chords
    let finalNotes = notes
    let finalTempo = tempo
    let finalKey = key

    if (!chords.trim()) {
      setAiLoading(true)
      try {
        const r = await fetchChordData({ name, artist, key }, { allowWebFallback: true })
        if (r.reason === 'ok') {
          if (r.tempo) finalTempo = r.tempo
          if (r.notes) finalNotes = r.notes
          if (r.chords) finalChords = r.chords
          if (r.key) finalKey = r.key
        }
      } catch(e) { console.error(e) }
      setAiLoading(false)
    }

    const { data: { user } } = await supabase.auth.getUser()
    const { error } = await supabase.from('songs').insert({
      name: name.trim(), artist: artist.trim(), key: finalKey, event_type: event,
      patch, chords: finalChords, notes: finalNotes, tempo: finalTempo,
      tags: tags.trim() || null, bpm: bpm ? parseInt(bpm) : null,
      user_id: user?.id
    })
    if (!error) {
      setName(''); setArtist(''); setKey('D'); setChords('')
      setNotes(''); setTempo(''); setEvent('kumzitz'); setTags(''); setBpm('')
      onSaved()
    }
    setSaving(false)
  }

  const googleUrl = `https://www.google.com/search?q=${encodeURIComponent(name + ' ' + artist + ' chords')}`

  return (
    <div style={{ padding:'16px 22px', paddingBottom:'calc(90px + env(safe-area-inset-bottom))' }}>
      <div style={{ background:'#131215', border:'1px solid #1e1e22', borderRadius:8, padding:16, marginBottom:12 }}>
        <div style={addLabel}>Song Info</div>
        {[
          ['Song name', <input key="name" value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. Od Yishama" style={inp2()} autoFocus autoCorrect="off" autoCapitalize="words" spellCheck={false} />],
          ['Artist', <input key="artist" value={artist} onChange={e=>setArtist(e.target.value)} placeholder="e.g. MBD, Traditional..." style={inp2()} autoCorrect="off" autoCapitalize="words" spellCheck={false} />],
        ].map(([label, input]) => (
          <div key={label} style={{ marginBottom:10 }}>
            <label style={addLabel}>{label}</label>
            {input}
          </div>
        ))}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
          <div>
            <label style={addLabel}>Key</label>
            <select value={key} onChange={e=>setKey(e.target.value)} style={inp2()}>
              {KEYS.map(k=><option key={k}>{k}</option>)}
            </select>
          </div>
          <div>
            <label style={addLabel}>Event</label>
            <select value={event} onChange={e=>setEvent(e.target.value)} style={inp2()}>
              <option value="kumzitz">Kumzitz</option>
              <option value="sheva">Sheva Brachos</option>
              <option value="wedding">Wedding</option>
              <option value="all">All events</option>
            </select>
          </div>
          <div style={{ gridColumn:'1/-1' }}>
            <label style={addLabel}>Patch</label>
            <select value={patch} onChange={e=>setPatch(e.target.value)} style={inp2()}>
              {PATCHES.map(p=><option key={p}>{p}</option>)}
            </select>
          </div>
          <div style={{ gridColumn:'1/-1' }}>
            <label style={addLabel}>Tempo</label>
            <input value={tempo} onChange={e=>setTempo(e.target.value)} placeholder="e.g. Slow, Upbeat..." style={inp2()} />
          </div>
          <div>
            <label style={addLabel}>BPM</label>
            <input type="number" inputMode="numeric" value={bpm} onChange={e=>setBpm(e.target.value)} placeholder="e.g. 72" style={inp2()} />
          </div>
          <div>
            <label style={addLabel}>Tags</label>
            <input value={tags} onChange={e=>setTags(e.target.value)} placeholder="e.g. slow, niggun" style={inp2()} autoCorrect="off" autoCapitalize="none" />
          </div>
        </div>
      </div>

      <div style={{ background:'#131215', border:'1px solid #1e1e22', borderRadius:8, padding:16, marginBottom:12 }}>
        <div style={addLabel}>Find Chords</div>
        <div style={{ display:'flex', gap:8, marginBottom: addAiError ? 8 : 12 }}>
          <button onClick={searchChords} disabled={aiLoading || !name.trim()} style={{
            flex:1, padding:'11px 0', background:'transparent',
            border:`1px solid ${aiLoading || !name.trim() ? '#1e1e1e' : 'rgba(199,178,122,0.22)'}`, borderRadius:7,
            color: aiLoading || !name.trim() ? '#3a3a3a' : GOLD,
            fontSize:12, fontWeight:600, cursor: name.trim() ? 'pointer' : 'not-allowed',
            fontFamily:'Inter, sans-serif', letterSpacing:'0.06em', textTransform:'uppercase',
          }}>
            {aiLoading ? 'Searching...' : '✦ Search Chords'}
          </button>
          <a href={googleUrl} target="_blank" rel="noopener noreferrer" style={{
            flex:1, padding:'11px 0', background:'transparent',
            border:'1px solid #1e1e1e', borderRadius:7, color:'#4a4a4a',
            fontSize:12, fontWeight:600, textDecoration:'none', textAlign:'center', display:'block',
            fontFamily:'Inter, sans-serif', letterSpacing:'0.04em', textTransform:'uppercase',
          }}>⌕ Google</a>
        </div>
        {addAiError && (
          <div style={{ fontSize:11, color:'#c04040', fontFamily:'Inter, sans-serif', marginBottom:10, lineHeight:1.5 }}>{addAiError}</div>
        )}
        <label style={addLabel}>Chords</label>
        {chords && chords.trim() && (
          <div style={{ ...s.panel, marginBottom:8, overflowX:'auto' }}>
            <ChordLyricDisplay text={chords} fontSize={13} />
          </div>
        )}
        <textarea
          value={chords} onChange={e=>setChords(e.target.value)}
          placeholder={'Intro: Dm | Gm | A7 | Dm\nVerse: Dm | Gm | Dm | A7\nChorus: F | Bb | C | Dm'}
          rows={4}
          style={s.chordBox}
          autoCorrect="off" autoCapitalize="none" spellCheck={false}
        />
        <label style={{ ...addLabel, marginTop:12 }}>Performance notes</label>
        <textarea
          value={notes} onChange={e=>setNotes(e.target.value)}
          placeholder="Tips, energy arc, watch-outs..."
          rows={2}
          style={s.fieldTextarea}
        />
      </div>

      <button onClick={save} disabled={saving || aiLoading || !name.trim()} style={{
        width:'100%', padding:16, background: name.trim() && !saving && !aiLoading ? GOLD : '#131215',
        border:'none', borderRadius:0, color: name.trim() && !saving && !aiLoading ? '#000' : DISABLED,
        font:`700 13px ${MONO}`, cursor: name.trim() && !saving && !aiLoading ? 'pointer' : 'not-allowed',
        letterSpacing:'0.1em', textTransform:'uppercase',
      }}>
        {saving || aiLoading ? 'Saving...' : 'Save song'}
      </button>
    </div>
  )
}

function AuthScreen() {
  const [mode, setMode] = useState('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  async function submit() {
    if (!email.trim() || !password.trim()) return
    setLoading(true); setError(''); setSuccess('')
    if (mode === 'signup') {
      const { error } = await supabase.auth.signUp({ email: email.trim(), password })
      if (error) setError(error.message)
      else setSuccess('Check your email to confirm your account, then sign in.')
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
      if (error) setError(error.message === 'Invalid login credentials' ? 'Wrong email or password.' : error.message)
    }
    setLoading(false)
  }

  const ready = email.trim() && password.trim()

  return (
    <div style={{ minHeight:'100dvh', background:'#0d0d0f', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:24, fontFamily:'Inter, sans-serif' }}>
      <div style={{ display:'flex', alignItems:'center', gap:9, marginBottom:36 }}>
        <svg width="20" height="20" viewBox="0 0 16 16" fill="none">
          <line x1="0" y1="4" x2="11" y2="4" stroke={GOLD} strokeWidth="0.75"/>
          <line x1="0" y1="7.5" x2="11" y2="7.5" stroke={GOLD} strokeWidth="0.75"/>
          <line x1="0" y1="11" x2="11" y2="11" stroke={GOLD} strokeWidth="0.75"/>
          <line x1="10" y1="3.5" x2="10" y2="11.5" stroke={GOLD} strokeWidth="1"/>
          <ellipse cx="8.3" cy="12" rx="2.3" ry="1.5" fill={GOLD} transform="rotate(-15 8.3 12)"/>
        </svg>
        <span style={{ fontFamily:'Space Grotesk, sans-serif', fontStyle:'italic', fontSize:32, fontWeight:700, color:'#EDEBE6', letterSpacing:'-0.015em' }}>Corda</span>
      </div>

      <div className="auth-card" style={{ width:'100%', maxWidth:360, background:'linear-gradient(160deg,#131311,#0f0f0e)', border:'1px solid #1c1c1a', borderRadius:22, padding:30 }}>
        <div style={{ fontSize:9, fontWeight:700, color:'#555', textTransform:'uppercase', letterSpacing:'0.2em', marginBottom:20, textAlign:'center' }}>
          {mode === 'signin' ? 'Sign in to your library' : 'Create your library'}
        </div>

        {/* Google OAuth */}
        <button
          onClick={async () => {
            setError('')
            const { error } = await supabase.auth.signInWithOAuth({
              provider: 'google',
              options: {
                redirectTo: window.location.origin,
                queryParams: { prompt: 'select_account' },
              },
            })
            if (error) setError(error.message)
          }}
          style={{ width:'100%', padding:'11px 14px', background:'#fff', border:'none', borderRadius:10, color:'#1a1a1a', fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:'Inter, sans-serif', display:'flex', alignItems:'center', justifyContent:'center', gap:10, marginBottom:18, letterSpacing:'0.01em' }}>
          <svg width="18" height="18" viewBox="0 0 18 18">
            <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"/>
            <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z"/>
            <path fill="#FBBC05" d="M3.964 10.707c-.18-.54-.282-1.117-.282-1.707s.102-1.167.282-1.707V4.961H.957C.347 6.175 0 7.55 0 9s.347 2.825.957 4.039l3.007-2.332z"/>
            <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.961L3.964 7.293C4.672 5.166 6.656 3.58 9 3.58z"/>
          </svg>
          Continue with Google
        </button>

        {/* Divider */}
        <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:18 }}>
          <div style={{ flex:1, height:1, background:'#1e1e1e' }} />
          <span style={{ fontSize:10, color:'#333', fontFamily:'Inter, sans-serif', letterSpacing:'0.08em', textTransform:'uppercase' }}>or</span>
          <div style={{ flex:1, height:1, background:'#1e1e1e' }} />
        </div>

        <div style={{ marginBottom:12 }}>
          <label style={{ fontSize:9, color:'#555', fontWeight:600, display:'block', marginBottom:6, textTransform:'uppercase', letterSpacing:'0.14em' }}>Email</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && submit()} placeholder="you@example.com"
            className="focus-gold"
            style={{ width:'100%', padding:'11px 14px', background:'#111', border:'1px solid #1e1e1e', borderRadius:8, color:'#EDEBE6', fontSize:15, boxSizing:'border-box', outline:'none', fontFamily:'Inter, sans-serif' }}
            autoComplete="email" autoCorrect="off" autoCapitalize="none" spellCheck={false} />
        </div>

        <div style={{ marginBottom: error || success ? 14 : 22 }}>
          <label style={{ fontSize:9, color:'#555', fontWeight:600, display:'block', marginBottom:6, textTransform:'uppercase', letterSpacing:'0.14em' }}>Password</label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && submit()}
            placeholder={mode === 'signup' ? 'At least 6 characters' : '••••••••'}
            className="focus-gold"
            style={{ width:'100%', padding:'11px 14px', background:'#111', border:'1px solid #1e1e1e', borderRadius:8, color:'#EDEBE6', fontSize:15, boxSizing:'border-box', outline:'none', fontFamily:'Inter, sans-serif' }}
            autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} />
        </div>

        {error && <div style={{ fontSize:12, color:'#c04040', marginBottom:14, lineHeight:1.5 }}>{error}</div>}
        {success && <div style={{ fontSize:12, color:'#5a9e5a', marginBottom:14, lineHeight:1.6 }}>{success}</div>}

        <button onClick={submit} disabled={loading || !ready}
          style={{ width:'100%', padding:14, background: ready ? GOLD : '#181818', border:'none', borderRadius:10, color: ready ? '#000' : '#3a3a3a', fontSize:13, fontWeight:700, cursor: ready ? 'pointer' : 'default', fontFamily:'Inter, sans-serif', letterSpacing:'0.08em', textTransform:'uppercase', transition:'background 0.15s, color 0.15s' }}>
          {loading ? '…' : mode === 'signin' ? 'Sign in' : 'Create account'}
        </button>

        <button onClick={() => { setMode(m => m === 'signin' ? 'signup' : 'signin'); setError(''); setSuccess('') }}
          style={{ width:'100%', marginTop:16, background:'none', border:'none', color:'#5a5a5a', fontSize:12, cursor:'pointer', fontFamily:'Inter, sans-serif', padding:0, lineHeight:1.5 }}>
          {mode === 'signin' ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
        </button>
      </div>

      <div style={{ marginTop:24, fontSize:11, color:'#333', textAlign:'center', lineHeight:1.6 }}>
        Performance chord book for live musicians
      </div>
    </div>
  )
}

export default function App() {
  const [tab, setTab] = useState('songs')
  const [showAdd, setShowAdd] = useState(false)      // Add-song overlay (folded in from Songs)
  const [showSounds, setShowSounds] = useState(false) // Sounds/patches reference overlay
  const [kfRoot, setKfRoot] = useState(7)            // capo tool root (chromatic index, default G)
  const [songs, setSongs] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [search, setSearch] = useState('')
  const [eventFilter, setEventFilter] = useState('all')
  const [favFilter, setFavFilter] = useState(false)
  const [expandedId, setExpandedId] = useState(null)
  const [gigSongs, setGigSongs] = useState(null)
  const [gigReturnTab, setGigReturnTab] = useState('songs')
  const [aiLoadingId, setAiLoadingId] = useState(null)
  const [aiError, setAiError] = useState('')
  const [deleteConfirmId, setDeleteConfirmId] = useState(null)
  const [tagFilter, setTagFilter] = useState('')
  const [scrollY, setScrollY] = useState(0)  // drives Songs large-title collapse

  // Fill-all state
  const [fillAllConfirm, setFillAllConfirm] = useState(false)
  const [fillAllRunning, setFillAllRunning] = useState(false)
  const [fillAllProgress, setFillAllProgress] = useState({ done: 0, total: 0 })
  const [fillAllSummary, setFillAllSummary] = useState('')
  const fillAllAbort = useRef(false)

  // Expanded card local state for key/chords (supports transpose flow)
  const [xKey, setXKey] = useState('D')         // what's in the dropdown
  const [xChordsKey, setXChordsKey] = useState('D') // what key the chords are currently in
  const [xChords, setXChords] = useState('')     // chord text (may be locally transposed)
  const [xSaving, setXSaving] = useState(false)
  const [xSaved, setXSaved] = useState(false)

  const [kfCrowd, setKfCrowd] = useState('mixed')
  const [kfComfort, setKfComfort] = useState('medium')
  const [kfHasSinger, setKfHasSinger] = useState(() => {
    try { const p = JSON.parse(localStorage.getItem('corda_singer_profile')); return p?.hasSinger || false } catch { return false }
  })
  const [kfVoice, setKfVoice] = useState(() => {
    try { const p = JSON.parse(localStorage.getItem('corda_singer_profile')); return p?.voice || 'baritone' } catch { return 'baritone' }
  })
  const [kfTopNote, setKfTopNote] = useState(() => {
    try { const p = JSON.parse(localStorage.getItem('corda_singer_profile')); return p?.topNote || 'A4' } catch { return 'A4' }
  })
  const [kfSongRange, setKfSongRange] = useState(() => {
    try { const p = JSON.parse(localStorage.getItem('corda_singer_profile')); return p?.songRange || 'medium' } catch { return 'medium' }
  })
  const [kfResult, setKfResult] = useState(null)
  const [kfApplySongId, setKfApplySongId] = useState('')
  const [kfApplied, setKfApplied] = useState(false)
  const [kfProfileSaved, setKfProfileSaved] = useState(false)
  const [kfSongSearch, setKfSongSearch] = useState('')
  const [kfSongDropdown, setKfSongDropdown] = useState(false)

  const [user, setUser] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setAuthLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => { if (user) fetchSongs() }, [user])

  // Sync expanded card state when a different song is expanded
  useEffect(() => {
    setAiError('')
    if (expandedId) {
      const song = songs.find(s => s.id === expandedId)
      if (song) {
        setXKey(song.key || 'D')
        setXChordsKey(song.key || 'D')
        setXChords(song.chords || '')
        setXSaved(false)
      }
    }
  }, [expandedId])

  async function fetchSongs() {
    setLoading(true)
    setLoadError(false)
    const { data, error } = await supabase.from('songs').select('*').eq('user_id', user.id).order('created_at', { ascending: true })
    if (error) { setLoadError(true) } else { setSongs(data || []) }
    setLoading(false)
  }

  async function updateSong(id, field, value) {
    await supabase.from('songs').update({ [field]: value }).eq('id', id)
    setSongs(prev => prev.map(s => s.id === id ? { ...s, [field]: value } : s))
  }

  async function fillWithAI(song) {
    setAiLoadingId(song.id)
    setAiError('')
    try {
      const r = await fetchChordData({ name: song.name, artist: song.artist, key: song.key }, { allowWebFallback: true })
      if (r.reason === 'ok') {
        const updates = {}
        if (r.tempo) updates.tempo = r.tempo
        if (r.notes) updates.notes = r.notes
        if (r.chords) updates.chords = r.chords
        if (r.key) updates.key = r.key
        if (Object.keys(updates).length) {
          await supabase.from('songs').update(updates).eq('id', song.id)
          setSongs(prev => prev.map(s => s.id === song.id ? { ...s, ...updates } : s))
          if (expandedId === song.id) {
            if (updates.chords !== undefined) setXChords(updates.chords)
            if (updates.key !== undefined) {
              setXKey(updates.key)
              setXChordsKey(updates.key)
            }
            setXSaved(false)
          }
        }
      } else {
        setAiError(chordErrorMsg(r.reason, r.error))
      }
    } catch(e) { console.error(e); setAiError('Network error. Try again.') }
    setAiLoadingId(null)
  }

  async function fillAllMissing() {
    const missing = songs.filter(s => !s.chords?.trim())
    if (!missing.length) return
    setFillAllConfirm(false)
    setFillAllRunning(true)
    setFillAllSummary('')
    fillAllAbort.current = false
    setFillAllProgress({ done: 0, total: missing.length })

    let filled = 0, unknown = 0, consecutiveFails = 0, stopped = ''
    for (let i = 0; i < missing.length; i++) {
      if (fillAllAbort.current) { stopped = 'Cancelled.'; break }
      const song = missing[i]
      // Claude only in batch (no web fallback) so a big library can't drain the Gemini quota.
      const r = await fetchChordData({ name: song.name, artist: song.artist, key: song.key }, { allowWebFallback: false })
      if (r.reason === 'ok') {
        const updates = {}
        if (r.tempo) updates.tempo = r.tempo
        if (r.notes) updates.notes = r.notes
        if (r.chords) updates.chords = r.chords
        if (r.key) updates.key = r.key
        if (Object.keys(updates).length) {
          await supabase.from('songs').update(updates).eq('id', song.id)
          setSongs(prev => prev.map(s => s.id === song.id ? { ...s, ...updates } : s))
          filled++
        }
        consecutiveFails = 0
      } else if (r.reason === 'rate' || r.reason === 'quota' || r.reason === 'error') {
        // Service is refusing calls — stop, don't keep hammering it.
        stopped = chordErrorMsg(r.reason, r.error)
        break
      } else {
        if (r.reason === 'unknown') unknown++
        consecutiveFails++
        if (consecutiveFails >= 3) { stopped = 'Stopped after 3 songs in a row could not be filled.'; break }
      }
      setFillAllProgress({ done: i + 1, total: missing.length })
      if (i < missing.length - 1 && !fillAllAbort.current) {
        await new Promise(res => setTimeout(res, 500))
      }
    }

    setFillAllRunning(false)
    let summary = `Filled ${filled} of ${missing.length}.`
    if (unknown) summary += ` ${unknown} not known by Claude.`
    if (stopped) summary += ` ${stopped}`
    setFillAllSummary(summary)
  }

  function handleTranspose() {
    const fromIdx = KEY_TO_CHROMA[xChordsKey] ?? 0
    const toIdx = KEY_TO_CHROMA[xKey] ?? 0
    let semitones = toIdx - fromIdx
    if (semitones > 6) semitones -= 12
    if (semitones < -6) semitones += 12
    if (semitones === 0) return
    const transposed = transposeChordText(xChords, semitones)
    setXChords(transposed)
    setXChordsKey(xKey)
    setXSaved(false)
  }

  async function saveExpandedCard(songId) {
    setXSaving(true)
    await supabase.from('songs').update({ key: xKey, chords: xChords }).eq('id', songId)
    setSongs(prev => prev.map(s => s.id === songId ? { ...s, key: xKey, chords: xChords } : s))
    setXSaved(true)
    setTimeout(() => setXSaved(false), 2000)
    setXSaving(false)
  }

  async function deleteSong(id) {
    await supabase.from('songs').delete().eq('id', id)
    setSongs(prev => prev.filter(s => s.id !== id))
    setExpandedId(null)
  }

  function runKeyFinder() {
    const cr = CROWD_RANGES[kfCrowd]
    let tLow = cr.low, tHigh = cr.high
    if (kfComfort === 'strong') { tLow -= 1; tHigh += 1 }
    if (kfComfort === 'passive') { tLow += 1; tHigh -= 2 }
    if (kfHasSinger) {
      const top = NOTE_MIDI[kfTopNote]
      const span = kfSongRange === 'narrow' ? 12 : kfSongRange === 'medium' ? 15 : 19
      const sHigh = Math.min(top, VOICE_RANGES[kfVoice].high)
      tLow = Math.round((tLow + (sHigh - span)) / 2)
      tHigh = Math.round((tHigh + sHigh) / 2)
    }
    let best = 'G', bestScore = -999
    const scores = {}
    for (const [key, root] of Object.entries(KEY_ROOTS)) {
      const score = -(Math.abs((root + 12) - tHigh) + Math.abs(root - tLow))
      scores[key] = score
      if (score > bestScore) { bestScore = score; best = key }
    }
    const alts = Object.entries(scores).sort((a,b) => b[1]-a[1]).slice(1,4).map(([k])=>k)
    setKfResult({ key: best, alts })
    setKfApplySongId('')
    setKfApplied(false)
    setKfSongSearch('')
    setKfSongDropdown(false)
  }

  const allTags = [...new Set(
    songs.flatMap(s => (s.tags || '').split(',').map(t => t.trim()).filter(Boolean))
  )].sort()

  const filtered = songs.filter(s => {
    const matchEvent = eventFilter === 'all' || s.event_type === eventFilter || s.event_type === 'all'
    const matchQ = !search || s.name.toLowerCase().includes(search.toLowerCase()) || (s.artist||'').toLowerCase().includes(search.toLowerCase())
    const matchFav = !favFilter || s.is_favorite
    const matchTag = !tagFilter || (s.tags || '').split(',').map(t => t.trim()).includes(tagFilter)
    return matchEvent && matchQ && matchFav && matchTag
  })

  const alphaGroups = groupAlphabetically(filtered)

  function renderSongCard(song) {
    const isExpanded = expandedId === song.id
    const hasChords = !!song.chords?.trim()
    return (
      <div key={song.id} style={s.row}>
        <div className="press" style={s.rowHead} onClick={() => { setExpandedId(isExpanded ? null : song.id); setDeleteConfirmId(null) }}>
          <div style={{ display:'flex', alignItems:'center', gap:10, minWidth:0 }}>
            <div style={s.rowDot(hasChords)} />
            <div style={{ minWidth:0 }}>
              <div style={s.rowName}>{song.name}</div>
              <div style={s.rowArtist}>{song.artist || '—'}</div>
            </div>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:12, flexShrink:0 }}>
            <button style={s.star(song.is_favorite)} onClick={e => { e.stopPropagation(); updateSong(song.id, 'is_favorite', !song.is_favorite) }}>★</button>
            {song.key && <span style={s.rowKey}>{song.key}</span>}
          </div>
        </div>
        <div style={s.expandWrap(isExpanded)}>
          <div style={{ overflow:'hidden', minHeight:0 }}>
          {isExpanded && (
          <div style={{ padding:'2px 2px 20px 16px' }} className="card-detail">
            <div style={s.detailGrid}>
              <div style={{gridColumn:'1/-1'}}>
                <label style={s.fieldLabel}>Song name</label>
                <input key={`name-${song.id}`} defaultValue={song.name} onBlur={e => { if (e.target.value.trim()) updateSong(song.id,'name',e.target.value.trim()) }} style={s.fieldInput} autoCorrect="off" autoCapitalize="words" spellCheck={false} />
              </div>
              <div style={{gridColumn:'1/-1'}}>
                <label style={s.fieldLabel}>Artist</label>
                <input key={`artist-${song.id}`} defaultValue={song.artist||''} onBlur={e => updateSong(song.id,'artist',e.target.value.trim()||null)} placeholder="e.g. MBD, Traditional..." style={s.fieldInput} autoCorrect="off" autoCapitalize="words" spellCheck={false} />
              </div>
              <div>
                <label style={s.fieldLabel}>Key</label>
                <div style={{ display:'flex', gap:6 }}>
                  <select value={xKey} onChange={e => setXKey(e.target.value)} style={{ ...s.fieldSelect, flex:1 }}>
                    {KEYS.map(k => <option key={k}>{k}</option>)}
                  </select>
                  <button
                    onClick={handleTranspose}
                    disabled={xKey === xChordsKey}
                    title="Transpose chords to selected key"
                    style={{ padding:'0 10px', background:'transparent', border:`1px solid ${xKey !== xChordsKey ? GOLD_DIM : '#1c1c1c'}`, borderRadius:6, color: xKey !== xChordsKey ? GOLD : '#444', fontSize:11, fontWeight:600, cursor: xKey !== xChordsKey ? 'pointer' : 'default', whiteSpace:'nowrap', flexShrink:0, fontFamily:'Inter, sans-serif', letterSpacing:'0.06em', height:36 }}>
                    Transpose
                  </button>
                </div>
              </div>
              <div>
                <label style={s.fieldLabel}>Event</label>
                <select value={song.event_type || 'kumzitz'} onChange={e => updateSong(song.id,'event_type',e.target.value)} style={s.fieldSelect}>
                  <option value="kumzitz">Kumzitz</option>
                  <option value="sheva">Sheva Brachos</option>
                  <option value="wedding">Wedding</option>
                  <option value="all">All events</option>
                </select>
              </div>
              <div style={{gridColumn:'1/-1'}}>
                <label style={s.fieldLabel}>Patch / Sound</label>
                <select value={song.patch || ''} onChange={e => updateSong(song.id,'patch',e.target.value)} style={s.fieldSelect}>
                  {PATCHES.map(p => <option key={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <label style={s.fieldLabel}>Tempo</label>
                <input key={`tempo-${song.id}-${song.tempo||''}`} defaultValue={song.tempo||''} onBlur={e => updateSong(song.id,'tempo',e.target.value)} placeholder="e.g. Slow build..." style={s.fieldInput} />
              </div>
              <div>
                <label style={s.fieldLabel}>BPM</label>
                <input key={`bpm-${song.id}-${song.bpm||''}`} type="number" inputMode="numeric" defaultValue={song.bpm||''} onBlur={e => updateSong(song.id,'bpm', e.target.value ? parseInt(e.target.value) : null)} placeholder="e.g. 72" style={s.fieldInput} />
              </div>
              <div style={{gridColumn:'1/-1'}}>
                <label style={s.fieldLabel}>Tags</label>
                <input key={`tags-${song.id}-${song.tags||''}`} defaultValue={song.tags||''} onBlur={e => updateSong(song.id,'tags', e.target.value || null)} placeholder="e.g. slow, niggun, shabbos" style={s.fieldInput} autoCorrect="off" autoCapitalize="none" spellCheck={false} />
              </div>
            </div>

            <div style={{ height:1, background:'#161616', margin:'4px -16px 14px' }} />

            <div style={{marginBottom:10}}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
                <span style={{ ...s.fieldLabel, marginBottom:0, display:'inline' }}>Chords</span>
                <button onClick={() => fillWithAI(song)} disabled={aiLoadingId === song.id}
                  style={{ background:'transparent', border:`1px solid ${aiLoadingId === song.id ? '#1e1e1e' : 'rgba(199,178,122,0.22)'}`, borderRadius:5, color: aiLoadingId === song.id ? '#444' : GOLD, fontSize:10, fontWeight:600, padding:'4px 9px', cursor: aiLoadingId === song.id ? 'default' : 'pointer', fontFamily:'Inter, sans-serif', letterSpacing:'0.06em', textTransform:'uppercase' }}>
                  {aiLoadingId === song.id ? 'Searching...' : '✦ Fill with Chords'}
                </button>
              </div>
              {aiError && expandedId === song.id && (
                <div style={{ fontSize:11, color:'#c04040', fontFamily:'Inter, sans-serif', marginBottom:6, lineHeight:1.5 }}>{aiError}</div>
              )}
              {xChords && xChords.trim() && (
                <div style={{ background:'#060606', border:`1px solid rgba(199,178,122,0.15)`, borderRadius:7, padding:'12px 14px', marginBottom:8, overflowX:'auto' }}>
                  <ChordLyricDisplay text={xChords} fontSize={13} />
                </div>
              )}
              <textarea
                value={xChords}
                onChange={e => { setXChords(e.target.value); setXSaved(false) }}
                rows={3}
                placeholder="Chords will appear here..."
                style={s.chordBox}
                autoCorrect="off" autoCapitalize="none" spellCheck={false}
              />
            </div>

            <div style={{ height:1, background:'#161616', margin:'4px -16px 14px' }} />

            <div style={{marginBottom:14}}>
              <label style={s.fieldLabel}>Notes</label>
              <textarea key={`notes-${song.id}-${song.notes||''}`} defaultValue={song.notes||''} onBlur={e => updateSong(song.id,'notes',e.target.value)} rows={2} style={s.fieldTextarea} autoCorrect="off" autoCapitalize="sentences" spellCheck={false} />
            </div>

            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:8 }}>
              <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
                <button
                  onClick={() => { setGigSongs([song]); setGigReturnTab('songs'); setTab('gig') }}
                  style={{ padding:'8px 13px', background:'transparent', border:`1px solid rgba(199,178,122,0.22)`, borderRadius:6, color:GOLD, fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'Inter, sans-serif', letterSpacing:'0.04em' }}>
                  ▶ Play
                </button>
                {deleteConfirmId === song.id
                  ? <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                      <span style={{ fontSize:11, color:'#c04040', fontFamily:'Inter, sans-serif' }}>Delete?</span>
                      <button onClick={() => { deleteSong(song.id); setDeleteConfirmId(null) }} style={{ padding:'6px 10px', background:'none', border:'1px solid #8a2020', borderRadius:5, color:'#c04040', fontSize:12, cursor:'pointer', fontFamily:'Inter, sans-serif' }}>Yes</button>
                      <button onClick={() => setDeleteConfirmId(null)} style={{ padding:'6px 8px', background:'none', border:'1px solid #1e1e1e', borderRadius:5, color:'#555', fontSize:12, cursor:'pointer', fontFamily:'Inter, sans-serif' }}>No</button>
                    </div>
                  : <button onClick={() => setDeleteConfirmId(song.id)} style={s.deleteBtn}>Remove</button>
                }
              </div>
              <button
                onClick={() => saveExpandedCard(song.id)}
                disabled={xSaving}
                style={{ flexShrink:0, padding:'8px 16px', background: xSaved ? 'transparent' : GOLD, border: xSaved ? '1px solid #2a4a2a' : 'none', borderRadius:6, color: xSaved ? '#5a9e5a' : '#000', fontSize:12, fontWeight:700, cursor:'pointer', transition:'all 0.2s', fontFamily:'Inter, sans-serif', letterSpacing:'0.05em', textTransform:'uppercase' }}>
                {xSaved ? 'Saved ✓' : xSaving ? 'Saving...' : 'Save key & chords'}
              </button>
            </div>
          </div>
          )}
          </div>
        </div>
      </div>
    )
  }

  if (authLoading) return (
    <div style={{ position:'fixed', inset:0, background:'#0d0d0f', display:'flex', alignItems:'center', justifyContent:'center' }}>
      <span style={{ fontFamily:'Space Grotesk, sans-serif', fontStyle:'italic', fontSize:28, fontWeight:700, color:'#2a2a2a', letterSpacing:'-0.015em' }}>Corda</span>
    </div>
  )
  if (!user) return <AuthScreen />

  return (
    <div style={s.app}>
      {/* Slim utility bar — brand mark + sign out. Screen identity lives in each tab's large title. */}
      <div style={s.header}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', paddingBottom:13 }}>
          <div style={{ display:'flex', alignItems:'center', gap:9 }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink:0 }}>
              <line x1="0" y1="4" x2="11" y2="4" stroke={GOLD} strokeWidth="0.75"/>
              <line x1="0" y1="7.5" x2="11" y2="7.5" stroke={GOLD} strokeWidth="0.75"/>
              <line x1="0" y1="11" x2="11" y2="11" stroke={GOLD} strokeWidth="0.75"/>
              <line x1="10" y1="3.5" x2="10" y2="11.5" stroke={GOLD} strokeWidth="1"/>
              <ellipse cx="8.3" cy="12" rx="2.3" ry="1.5" fill={GOLD} transform="rotate(-15 8.3 12)"/>
            </svg>
            <span style={{ fontFamily:'Space Grotesk, sans-serif', fontStyle:'italic', fontSize:19, fontWeight:700, color:'#EDEBE6', letterSpacing:'-0.02em', lineHeight:1 }}>Corda</span>
          </div>
          <button onClick={() => supabase.auth.signOut()} style={{ background:'none', border:'1px solid #1c1c1c', borderRadius:6, color:'#2e2e2e', fontSize:9, cursor:'pointer', fontFamily:'Inter, sans-serif', letterSpacing:'0.12em', textTransform:'uppercase', padding:'5px 10px', lineHeight:1 }}>Sign out</button>
        </div>
      </div>

      {/* iOS-style pinned compact header: fades/blurs in over the first 50px of Songs scroll. */}
      {tab === 'songs' && (() => {
        const t = Math.min(1, scrollY / 50)
        if (t <= 0) return null
        return (
          <div aria-hidden style={{ position:'fixed', top:0, left:0, right:0, zIndex:120,
            paddingTop:'calc(env(safe-area-inset-top) + 15px)',
            background:`rgba(13,13,15,${(0.88 * t).toFixed(3)})`,
            backdropFilter:'blur(20px) saturate(160%)', WebkitBackdropFilter:'blur(20px) saturate(160%)',
            borderBottom:`1px solid ${t > 0.6 ? HAIR : 'transparent'}`, opacity:t, pointerEvents:'none' }}>
            <div style={{ display:'flex', alignItems:'center', gap:8, padding:'0 22px 13px' }}>
              <div style={{ width:7, height:7, background:GOLD, flexShrink:0 }} />
              <span style={{ font:`700 15px ${DISPLAY}`, color:TXT, letterSpacing:'0.01em', textTransform:'uppercase' }}>Songs</span>
            </div>
          </div>
        )
      })()}

      <div style={s.scroll} onScroll={e => setScrollY(e.currentTarget.scrollTop)}>

        {tab === 'songs' && <div className="tab-fade">
          <div style={{ padding:'6px 22px 0' }}>
            {/* Large title + fold-in actions (Add / Sounds) — title fades as compact header takes over */}
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', ...s.largeTitle }}>
              <div style={{ display:'flex', alignItems:'center', gap:8, opacity: Math.max(0, 1 - scrollY / 42), transform:`translateY(${(-Math.min(1, scrollY / 50) * 6).toFixed(1)}px)` }}>
                <div style={s.largeTitleSquare} />
                <div style={s.largeTitleText}>Songs</div>
              </div>
              <div style={{ ...s.seamStrip, flexShrink:0 }}>
                <div className="press" style={{ ...s.seamCell, padding:'9px 14px' }} onClick={() => setShowSounds(true)}>
                  <span style={{ font:`700 10px ${MONO}`, letterSpacing:'0.1em', color:TXT3, whiteSpace:'nowrap' }}>◈&nbsp;SOUNDS</span>
                </div>
                <div className="press" style={{ ...s.seamCell, padding:'9px 14px' }} onClick={() => setShowAdd(true)}>
                  <span style={{ font:`700 10px ${MONO}`, letterSpacing:'0.1em', color:GOLD, whiteSpace:'nowrap' }}>+&nbsp;ADD</span>
                </div>
              </div>
            </div>

            {/* Search */}
            <div style={{ ...s.searchWrap, display:'flex', alignItems:'center', gap:10 }}>
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search songs…" style={{ ...s.searchInput, flex:1 }}
                autoCorrect="off" autoCapitalize="none" spellCheck={false} />
              {search
                ? <button onClick={() => setSearch('')} style={{ background:'none', border:'none', color:DIM, fontSize:16, cursor:'pointer', padding:0, lineHeight:1 }}>×</button>
                : <button onClick={() => { setGigSongs(filtered); setGigReturnTab('songs'); setTab('gig') }} disabled={!filtered.length}
                    title="Play filtered songs in Gig Mode"
                    style={{ background:'none', border:'none', color: filtered.length ? GOLD : DISABLED, fontSize:13, cursor: filtered.length ? 'pointer' : 'default', padding:0, lineHeight:1 }}>▶</button>
              }
            </div>

            {/* Two-way segmented filter */}
            <div style={s.segTrack}>
              <div style={s.segPill(favFilter ? '100%' : '0%')} />
              <div style={s.segOpt(!favFilter)} onClick={() => setFavFilter(false)}>ALL</div>
              <div style={s.segOpt(favFilter)} onClick={() => setFavFilter(true)}>★ FAVORITES</div>
            </div>

            {/* Event filter — square mono seam pills */}
            <div style={{ display:'flex', gap:1, marginTop:8, background:SEAM, padding:1, overflow:'hidden' }}>
              {['all','kumzitz','sheva','wedding'].map(ev => {
                const on = eventFilter === ev
                return (
                  <div key={ev} className="press" onClick={() => setEventFilter(ev)}
                    style={{ flex:1, textAlign:'center', padding:'7px 4px', cursor:'pointer', background: on ? '#1c1c20' : BG, font:`700 9px ${MONO}`, letterSpacing:'0.08em', color: on ? GOLD : DIM, textTransform:'uppercase', whiteSpace:'nowrap' }}>
                    {ev === 'all' ? 'ALL' : ev === 'sheva' ? 'SB' : ev === 'kumzitz' ? 'KZ' : 'WD'}
                  </div>
                )
              })}
            </div>

            {/* Tag filter */}
            {allTags.length > 0 && (
              <div style={{ display:'flex', gap:6, marginTop:8, overflowX:'auto', scrollbarWidth:'none' }}>
                {allTags.map(tag => {
                  const on = tagFilter === tag
                  return (
                    <button key={tag} className="press" onClick={() => setTagFilter(on ? '' : tag)}
                      style={{ background: on ? GOLD : 'transparent', border:`1px solid ${on ? GOLD : HAIR}`, color: on ? '#000' : DIM, font:`600 10px ${MONO}`, letterSpacing:'0.04em', padding:'5px 10px', cursor:'pointer', whiteSpace:'nowrap' }}>#{tag}</button>
                  )
                })}
              </div>
            )}

            {/* Filtered count */}
            {!loading && (search || eventFilter !== 'all' || favFilter || tagFilter) && (
              <div style={{ padding:'8px 0 2px', display:'flex', alignItems:'center', gap:8 }}>
                <span style={{ font:`400 10px ${MONO}`, color:DIM, letterSpacing:'0.06em' }}>{filtered.length} SONG{filtered.length !== 1 ? 'S' : ''}</span>
                <button onClick={() => { setSearch(''); setEventFilter('all'); setFavFilter(false); setTagFilter('') }}
                  style={{ background:'none', border:'none', color:DIM, fontSize:10, cursor:'pointer', fontFamily:'Inter, sans-serif', padding:0, textDecoration:'underline', textUnderlineOffset:2 }}>Clear filters</button>
              </div>
            )}
          </div>

          {/* Fill all missing chords bar */}
          {!loading && (() => {
            const missingCount = songs.filter(s => !s.chords?.trim()).length
            if (fillAllRunning) {
              return (
                <div style={{ margin:'0 12px 8px', background:GOLD_GLOW, border:`1px solid ${GOLD_DIM}`, borderRadius:10, padding:'10px 14px', display:'flex', alignItems:'center', justifyContent:'space-between', gap:10 }}>
                  <div style={{ flex:1 }}>
                    <div style={{ color:GOLD, fontSize:12, fontWeight:600, marginBottom:5, fontFamily:'Inter, sans-serif', letterSpacing:'0.04em' }}>
                      Filling {fillAllProgress.done} of {fillAllProgress.total}...
                    </div>
                    <div style={{ height:3, background:'#1c1c1c', borderRadius:2, overflow:'hidden' }}>
                      <div style={{ height:'100%', background:GOLD, borderRadius:2, width:`${Math.round((fillAllProgress.done / fillAllProgress.total) * 100)}%`, transition:'width 0.4s ease' }} />
                    </div>
                  </div>
                  <button
                    onClick={() => { fillAllAbort.current = true }}
                    style={{ background:'none', border:'1px solid #1c1c1c', borderRadius:5, color:'#444', fontSize:11, padding:'5px 10px', cursor:'pointer', flexShrink:0, fontFamily:'Inter, sans-serif' }}>
                    Cancel
                  </button>
                </div>
              )
            }
            if (fillAllSummary) {
              return (
                <div style={{ margin:'0 12px 8px', display:'flex', alignItems:'center', justifyContent:'space-between', gap:10 }}>
                  <span style={{ color:'#5a5a5a', fontSize:11, fontFamily:'Inter, sans-serif', lineHeight:1.5 }}>{fillAllSummary}</span>
                  <button onClick={() => setFillAllSummary('')}
                    style={{ background:'none', border:'1px solid #1c1c1c', borderRadius:5, color:'#444', fontSize:11, padding:'4px 10px', cursor:'pointer', flexShrink:0, fontFamily:'Inter, sans-serif' }}>
                    Dismiss
                  </button>
                </div>
              )
            }
            if (missingCount === 0) return null
            return (
              <div style={{ margin:'0 12px 8px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                <span style={{ color:'#5a5a5a', fontSize:11, fontFamily:'Inter, sans-serif' }}>{missingCount} song{missingCount !== 1 ? 's' : ''} missing chords</span>
                <button
                  onClick={() => setFillAllConfirm(true)}
                  style={{ background:'transparent', border:`1px solid ${GOLD_DIM}`, borderRadius:5, color:GOLD, fontSize:11, fontWeight:600, padding:'5px 12px', cursor:'pointer', fontFamily:'Inter, sans-serif', letterSpacing:'0.06em' }}>
                  ✦ Fill all missing
                </button>
              </div>
            )
          })()}

          <div style={{ padding:'0 22px 40px' }}>
          {loading
            ? <div style={{ marginTop:10 }}>
                {[1,2,3,4,5].map(i => (
                  <div key={i} className="skeleton" style={{ borderTop:`1px solid ${HAIR}`, padding:'16px 2px', opacity: 1 - i * 0.14, display:'flex', alignItems:'center', gap:10 }}>
                    <div style={{ width:6, height:6, background:'#26262b', flexShrink:0 }} />
                    <div style={{ flex:1 }}>
                      <div style={{ height:14, width:`${55 + (i * 17) % 35}%`, background:'#26262b', marginBottom:8 }} />
                      <div style={{ height:9, width:`${28 + (i * 13) % 25}%`, background:'#1c1c20' }} />
                    </div>
                    <div style={{ width:20, height:14, background:'#1c1c20' }} />
                  </div>
                ))}
              </div>
            : loadError
            ? <div style={s.empty}>
                <div style={{ marginBottom:16 }}>Couldn't load songs.</div>
                <button onClick={fetchSongs} style={{ background:'transparent', border:`1px solid ${GOLD_DIM}`, borderRadius:0, color:GOLD, font:`700 11px ${MONO}`, padding:'9px 22px', cursor:'pointer', letterSpacing:'0.1em', textTransform:'uppercase' }}>Retry</button>
              </div>
            : filtered.length === 0 && songs.length === 0
            ? <div style={s.empty}>
                <div style={{ color:TXT3, marginBottom:20 }}>Your song library is empty.</div>
                <button onClick={() => setShowAdd(true)} style={{ background:GOLD, border:'none', borderRadius:0, color:'#000', font:`700 12px ${MONO}`, padding:'12px 24px', cursor:'pointer', letterSpacing:'0.08em', textTransform:'uppercase' }}>+ Add your first song</button>
              </div>
            : filtered.length === 0
            ? <div style={s.empty}>No songs match your filters.</div>
            : alphaGroups.map(({ letter, songs: groupSongs }) => (
                <div key={letter}>
                  <div style={s.groupLetter}>{letter}</div>
                  {groupSongs.map(song => renderSongCard(song))}
                </div>
              ))
          }
          </div>
        </div>}

        {tab === 'keyfinder' && <div className="tab-fade" style={{ padding:'6px 22px 40px' }}>
          <div style={s.largeTitle}>
            <div style={s.largeTitleSquare} />
            <div style={s.largeTitleText}>Key Finder</div>
          </div>
          <div style={tick({ marginBottom:10 })}>BEST KEY FOR CROWD</div>
          <div style={s.kfCard}>
            <div style={s.kfLabel}>Crowd</div>
            {[
              ['Type', <select key="crowd" value={kfCrowd} onChange={e=>setKfCrowd(e.target.value)} style={s.kfSelect}>
                <option value="men">Men only</option><option value="mixed">Mixed</option>
                <option value="women">Women only</option><option value="kids">Mixed + kids</option>
                <option value="older">Older crowd</option><option value="young">Young / bochurim</option>
              </select>],
              ['Energy', <select key="energy" value={kfComfort} onChange={e=>setKfComfort(e.target.value)} style={s.kfSelect}>
                <option value="strong">Strong singers</option>
                <option value="medium">Medium</option>
                <option value="passive">Mostly listening</option>
              </select>],
              ['Singer?', <select key="singer" value={String(kfHasSinger)} onChange={e=>setKfHasSinger(e.target.value==='true')} style={s.kfSelect}>
                <option value="false">No singer</option>
                <option value="true">Yes — vocalist</option>
              </select>],
            ].map(([label, input]) => (
              <div key={label} style={s.kfRow}>
                <div style={s.kfRowLabel}>{label}</div>
                {input}
              </div>
            ))}
          </div>
          {kfHasSinger && (
            <div style={s.kfCard}>
              <div style={s.kfLabel}>Singer</div>
              {[
                ['Voice', <select key="voice" value={kfVoice} onChange={e=>setKfVoice(e.target.value)} style={s.kfSelect}>
                  <option value="tenor">Tenor</option><option value="baritone">Baritone</option>
                  <option value="bass">Bass</option><option value="alto">Alto</option>
                  <option value="soprano">Soprano</option>
                </select>],
                ['Top note', <select key="topnote" value={kfTopNote} onChange={e=>setKfTopNote(e.target.value)} style={s.kfSelect}>
                  {['D4','E4','F4','G4','A4','B4','C5','D5','E5'].map(n=><option key={n}>{n}</option>)}
                </select>],
                ['Range', <select key="range" value={kfSongRange} onChange={e=>setKfSongRange(e.target.value)} style={s.kfSelect}>
                  <option value="narrow">Narrow</option>
                  <option value="medium">Medium</option>
                  <option value="wide">Wide</option>
                </select>],
              ].map(([label, input]) => (
                <div key={label} style={s.kfRow}>
                  <div style={s.kfRowLabel}>{label}</div>
                  {input}
                </div>
              ))}
              <div style={{ display:'flex', gap:8, marginTop:10 }}>
                <button
                  onClick={() => {
                    localStorage.setItem('corda_singer_profile', JSON.stringify({ voice: kfVoice, topNote: kfTopNote, songRange: kfSongRange, hasSinger: kfHasSinger }))
                    setKfProfileSaved(true)
                    setTimeout(() => setKfProfileSaved(false), 2000)
                  }}
                  style={{ flex:1, padding:'8px 0', background:'transparent', border:`1px solid ${kfProfileSaved ? '#2a4a2a' : 'rgba(199,178,122,0.22)'}`, borderRadius:6, color: kfProfileSaved ? '#5a9e5a' : GOLD, fontSize:11, fontWeight:600, cursor:'pointer', transition:'all 0.2s', fontFamily:'Inter, sans-serif', letterSpacing:'0.06em' }}>
                  {kfProfileSaved ? 'Saved ✓' : 'Save singer profile'}
                </button>
                <button
                  onClick={() => {
                    localStorage.removeItem('corda_singer_profile')
                    setKfVoice('baritone')
                    setKfTopNote('A4')
                    setKfSongRange('medium')
                    setKfHasSinger(false)
                  }}
                  style={{ padding:'8px 12px', background:'transparent', border:'1px solid #1e1e1e', borderRadius:6, color:'#444', fontSize:11, fontWeight:500, cursor:'pointer', fontFamily:'Inter, sans-serif' }}>
                  Clear
                </button>
              </div>
            </div>
          )}
          <button onClick={runKeyFinder} style={s.runBtn}>Find best key</button>
          {kfResult && (
            <>
              <div style={s.kfResult}>
                <div style={s.kfResultKey}>{kfResult.key}</div>
                <div style={s.kfResultSub}>Suggested key</div>
                <div style={s.kfAlts}>
                  {kfResult.alts.map(k => <span key={k} style={s.kfAlt}>{k}</span>)}
                </div>
              </div>
              {(() => {
                const selectedSong = songs.find(s => s.id === kfApplySongId)
                const searchResults = kfSongSearch.trim()
                  ? songs.filter(s =>
                      s.name.toLowerCase().includes(kfSongSearch.toLowerCase()) ||
                      (s.artist||'').toLowerCase().includes(kfSongSearch.toLowerCase())
                    ).slice(0, 8)
                  : []
                return (
                  <div style={{ marginBottom:24, background:PANEL, border:`1px solid ${GOLD_DIM}`, borderRadius:8, padding:16 }}>
                    <div style={s.kfLabel}>Apply to song</div>

                    {/* Search input */}
                    <div style={{ position:'relative', marginBottom:8 }}>
                      <input
                        value={kfSongSearch}
                        onChange={e => {
                          setKfSongSearch(e.target.value)
                          setKfApplySongId('')
                          setKfApplied(false)
                          setKfSongDropdown(true)
                        }}
                        onFocus={() => setKfSongDropdown(true)}
                        onBlur={() => setTimeout(() => setKfSongDropdown(false), 150)}
                        placeholder="Search songs..."
                        className="focus-gold"
                        style={{ width:'100%', padding:'9px 10px', background:'#111', border:'1px solid #1e1e1e', borderRadius:6, color:'#EDEBE6', fontSize:13, boxSizing:'border-box', outline:'none', fontFamily:'Inter, sans-serif' }}
                        autoCorrect="off" autoCapitalize="none" spellCheck={false}
                      />

                      {/* Dropdown results */}
                      {kfSongDropdown && searchResults.length > 0 && (
                        <div style={{ position:'absolute', top:'100%', left:0, right:0, background:'#111', border:'1px solid #1e1e1e', borderRadius:10, marginTop:4, overflow:'hidden', zIndex:10 }}>
                          {searchResults.map(song => (
                            <div
                              key={song.id}
                              onClick={() => {
                                setKfApplySongId(song.id)
                                setKfSongSearch(song.name + (song.artist ? ` — ${song.artist}` : ''))
                                setKfSongDropdown(false)
                                setKfApplied(false)
                              }}
                              style={{ padding:'10px 12px', cursor:'pointer', borderBottom:'1px solid #1c1c1c', display:'flex', justifyContent:'space-between', alignItems:'center' }}
                              onMouseEnter={e => e.currentTarget.style.background=GOLD_GLOW}
                              onMouseLeave={e => e.currentTarget.style.background='transparent'}
                            >
                              <div>
                                <div style={{ color:'#EDEBE6', fontSize:13, fontFamily:'Space Grotesk, sans-serif' }}>{song.name}</div>
                                {song.artist && <div style={{ color:'#5a5a5a', fontSize:11, marginTop:1, fontFamily:'Inter, sans-serif' }}>{song.artist}</div>}
                              </div>
                              {song.key && <span style={s.keyBadge}>{song.key}</span>}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Selected song confirmation row */}
                    {selectedSong && (
                      <div style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 10px', background:'#0d0d0f', borderRadius:6, marginBottom:8 }}>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ color:'#EDEBE6', fontSize:13, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', fontFamily:'Space Grotesk, sans-serif' }}>{selectedSong.name}</div>
                          {selectedSong.artist && <div style={{ color:'#5a5a5a', fontSize:11, fontFamily:'Inter, sans-serif' }}>{selectedSong.artist}</div>}
                        </div>
                        <span style={{ color:'#444', fontSize:12, fontFamily:'Inter, sans-serif' }}>{selectedSong.key || '—'}</span>
                        <span style={{ color:'#444', fontSize:12 }}>→</span>
                        <span style={{ ...s.keyBadge, fontSize:13, padding:'3px 10px' }}>{kfResult.key}</span>
                      </div>
                    )}

                    <button
                      disabled={!kfApplySongId || kfApplied}
                      onClick={async () => {
                        await updateSong(kfApplySongId, 'key', kfResult.key)
                        setKfApplied(true)
                      }}
                      style={{ width:'100%', padding:'11px 0', background: kfApplied ? 'transparent' : (!kfApplySongId ? 'transparent' : GOLD), border: kfApplied ? '1px solid #2d4d2d' : `1px solid ${!kfApplySongId ? '#1c1c1c' : GOLD}`, borderRadius:6, color: kfApplied ? '#5a9e5a' : (!kfApplySongId ? '#444' : '#000'), fontSize:13, fontWeight:600, cursor: kfApplySongId && !kfApplied ? 'pointer' : 'default', boxSizing:'border-box', transition:'all 0.2s', fontFamily:'Inter, sans-serif', letterSpacing:'0.06em', textTransform:'uppercase' }}>
                      {kfApplied ? `Applied ${kfResult.key} ✓` : 'Apply key'}
                    </button>
                  </div>
                )
              })()}
            </>
          )}

          {/* === Capo / CAGED shapes === */}
          {(() => {
            const rootLabel = CHROMATIC[kfRoot]
            const shapes = capoShapes(kfRoot)
            const inKey = songs.filter(sg => KEY_TO_CHROMA[(sg.key || '').replace(/m$/, '')] === kfRoot)
            return (
              <div style={{ marginTop:30 }}>
                <div style={tick({ marginBottom:10 })}>SELECT ROOT</div>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:1, background:SEAM, borderRadius:10, overflow:'hidden', marginBottom:24 }}>
                  {CHROMATIC.map((label, i) => (
                    <div key={label} className="press" onClick={() => setKfRoot(i)}
                      style={{ background: i === kfRoot ? '#1c1c20' : BG, padding:'18px 0', textAlign:'center', cursor:'pointer' }}>
                      <span style={{ font:`700 16px ${MONO}`, color: i === kfRoot ? GOLD : TXT2 }}>{label}</span>
                    </div>
                  ))}
                </div>

                <div style={tick({ marginBottom:10 })}>CAPO SHAPES FOR {rootLabel}</div>
                <div style={{ ...s.panel, padding:0, marginBottom:24 }}>
                  {shapes.map((c, i) => (
                    <div key={c.shape} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'12px 16px', borderTop: i > 0 ? `1px solid ${HAIR}` : 'none' }}>
                      <span style={{ font:`400 13px 'Inter',sans-serif`, color:TXT2 }}>{c.fretLabel}</span>
                      <span style={{ font:`700 13px ${MONO}`, color:GOLD }}>Shape {c.shape}</span>
                    </div>
                  ))}
                </div>

                <div style={tick({ marginBottom:10 })}>SONGS IN {rootLabel}</div>
                {inKey.length
                  ? inKey.map(sg => (
                      <div key={sg.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'14px 2px', borderTop:`1px solid ${HAIR}` }}>
                        <span style={{ font:`500 15px ${DISPLAY}`, color:TXT }}>{sg.name}</span>
                        <span style={{ font:`400 12px 'Inter',sans-serif`, color:TXT3 }}>{sg.artist || '—'}</span>
                      </div>
                    ))
                  : <div style={{ color:DIM, fontSize:12, fontFamily:'Inter, sans-serif', padding:'14px 2px' }}>No songs in this key yet.</div>
                }
              </div>
            )
          })()}
        </div>}

        {tab === 'setlist' && (
          <div className="tab-fade">
            <SetListBuilder
              songs={songs}
              onPlay={setlistSongs => { setGigSongs(setlistSongs); setGigReturnTab('setlist'); setTab('gig') }}
            />
          </div>
        )}

      </div>

      <div style={s.bottomNav}>
        {TABS.map(t => {
          const active = tab === t.id
          return (
            <button key={t.id} style={s.navBtn()}
              onClick={() => { if (t.id === 'gig') { setGigSongs(null); setGigReturnTab('songs') } setScrollY(0); setTab(t.id) }}>
              <span key={active ? 'on' : 'off'} style={s.navIcon(active)} className={active ? 'nav-active-icon' : ''}>{t.icon}</span>
              <span style={s.navLabel(active)}>{t.label.toUpperCase()}</span>
            </button>
          )
        })}
      </div>

      {tab === 'gig' && <GigMode songs={gigSongs || songs} onExit={() => { setGigSongs(null); setTab(gigReturnTab) }} onSaveKey={(id, key) => updateSong(id, 'key', key)} />}

      {/* Add-song overlay (folded in from Songs header) */}
      {showAdd && (
        <div style={{ position:'fixed', inset:0, background:BG, zIndex:180, display:'flex', flexDirection:'column' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 22px', paddingTop:'calc(env(safe-area-inset-top) + 12px)', borderBottom:`1px solid ${HAIR}`, flexShrink:0 }}>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <div style={s.largeTitleSquare} />
              <div style={{ font:`700 15px ${DISPLAY}`, color:TXT, letterSpacing:'0.02em', textTransform:'uppercase' }}>Add Song</div>
            </div>
            <button onClick={() => setShowAdd(false)} style={{ background:'none', border:'none', color:DIM, fontSize:22, cursor:'pointer', padding:0, lineHeight:1 }}>✕</button>
          </div>
          <div style={{ flex:1, overflowY:'auto', WebkitOverflowScrolling:'touch' }}>
            <AddSongTab onSaved={async () => { await fetchSongs(); setShowAdd(false); setTab('songs') }} />
          </div>
        </div>
      )}

      {/* Sounds / patches reference overlay */}
      {showSounds && (
        <div style={{ position:'fixed', inset:0, background:BG, zIndex:180, display:'flex', flexDirection:'column' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 22px', paddingTop:'calc(env(safe-area-inset-top) + 12px)', borderBottom:`1px solid ${HAIR}`, flexShrink:0 }}>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <div style={s.largeTitleSquare} />
              <div style={{ font:`700 15px ${DISPLAY}`, color:TXT, letterSpacing:'0.02em', textTransform:'uppercase' }}>Sounds</div>
            </div>
            <button onClick={() => setShowSounds(false)} style={{ background:'none', border:'none', color:DIM, fontSize:22, cursor:'pointer', padding:0, lineHeight:1 }}>✕</button>
          </div>
          <div style={{ flex:1, overflowY:'auto', WebkitOverflowScrolling:'touch', padding:'6px 22px 40px' }}>
            {[
              { label:'Piano', items:[
                {name:'Warm Grand Piano',src:'Grand Piano Pack → Sampler',when:'Primary for any event'},
                {name:'Upright Piano',src:'Upright Piano by Spitfire',when:'Intimate kumzitz'},
                {name:'Felt Piano',src:'Spitfire LABS (free)',when:'Slow, introspective niggunim'},
                {name:'The Gentleman',src:'Komplete Start',when:'Dark, moody upright'},
              ]},
              { label:'Pads & Atmosphere', items:[
                {name:'Strings',src:'String Quartet — Spitfire',when:'Kumzitz & sheva brachos'},
                {name:'Choir Pad',src:'Analog Lab Pro V (Mellotron)',when:'Vocal texture layer'},
                {name:'Analog Pad',src:'Drift / Wavetable',when:'Warm background wash'},
                {name:'Orchestral Strings',src:'Orchestral Strings Pack',when:'Wedding processionals'},
              ]},
              { label:'Lead & Color', items:[
                {name:'Rhodes',src:'Electric Keyboards Pack',when:'Soulful melody lines'},
                {name:'Organ (B-3)',src:'Analog Lab Pro V',when:'High-energy endings'},
                {name:'Vital Synth',src:'Vital Audio (free)',when:'Modern pads & leads'},
              ]},
            ].map(sec => (
              <div key={sec.label} style={{ marginBottom:24 }}>
                <div style={tick({ marginBottom:10 })}>{sec.label}</div>
                {sec.items.map(p => (
                  <div key={p.name} style={{ padding:'12px 2px', borderTop:`1px solid ${HAIR}` }}>
                    <div style={{ font:`500 15px ${DISPLAY}`, color:TXT, marginBottom:3 }}>{p.name}</div>
                    <div style={{ font:`400 12px 'Inter',sans-serif`, color:TXT3, marginBottom:4 }}>{p.src}</div>
                    <div style={{ font:`400 12px 'Inter',sans-serif`, color:DIM, lineHeight:1.5 }}>{p.when}</div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Fill-all confirmation dialog */}
      {fillAllConfirm && (() => {
        const missingCount = songs.filter(s => !s.chords?.trim()).length
        return (
          <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.8)', zIndex:300, display:'flex', alignItems:'center', justifyContent:'center', padding:24 }}
            onClick={() => setFillAllConfirm(false)}>
            <div style={{ background:'#111', border:`1px solid rgba(199,178,122,0.18)`, borderRadius:16, padding:24, maxWidth:320, width:'100%' }}
              onClick={e => e.stopPropagation()}>
              <div style={{ fontSize:18, fontWeight:500, color:'#EDEBE6', marginBottom:8, fontFamily:'Space Grotesk, sans-serif' }}>Fill all missing chords?</div>
              <div style={{ fontSize:13, color:'#5a5a5a', lineHeight:1.7, marginBottom:20, fontFamily:'Inter, sans-serif' }}>
                This will look up chords and lyrics for <strong style={{ color:'#EDEBE6' }}>{missingCount} song{missingCount !== 1 ? 's' : ''}</strong> using Claude. Songs Claude doesn't recognize are skipped, and it stops early after 3 misses in a row.
              </div>
              <div style={{ display:'flex', gap:10 }}>
                <button onClick={() => setFillAllConfirm(false)}
                  style={{ flex:1, padding:'10px 0', background:'transparent', border:'1px solid #1c1c1c', borderRadius:6, color:'#555', fontSize:13, cursor:'pointer', fontFamily:'Inter, sans-serif' }}>
                  Cancel
                </button>
                <button onClick={fillAllMissing}
                  style={{ flex:2, padding:'10px 0', background:GOLD, border:'none', borderRadius:6, color:'#000', fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:'Inter, sans-serif', letterSpacing:'0.04em' }}>
                  ✦ Fill {missingCount} songs
                </button>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
