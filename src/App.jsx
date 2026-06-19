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
const EVENT_ACCENT = {
  kumzitz:'#5a9e5a', sheva:'#8b6fd4', wedding:'#c4862a', all:'#2a2a2a'
}
const GOLD = '#C9A84C'
const GOLD_DIM = 'rgba(201,168,76,0.25)'
const GOLD_GLOW = 'rgba(201,168,76,0.12)'

const CHROMATIC = ['C','C#','D','Eb','E','F','F#','G','Ab','A','Bb','B']
const KEY_TO_CHROMA = {
  'C':0,'C#':1,'Db':1,'D':2,'Eb':3,'E':4,'F':5,'F#':6,'Gb':6,'G':7,'Ab':8,'G#':8,'A':9,'Bb':10,'A#':10,'B':11
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
    <div style={{ fontFamily:'monospace', fontSize, overflowX:'auto' }}>
      {blocks.map((block, idx) => {
        if (block.type === 'gap') return <div key={idx} style={{ height:'0.75em' }} />
        if (block.type === 'section') return (
          <div key={idx} style={{ color:'#666660', fontSize: fontSize * 0.8, marginTop: idx > 0 ? 16 : 0, marginBottom:5, textTransform:'uppercase', letterSpacing:'0.15em', fontFamily:'Inter, sans-serif', fontWeight:500, textAlign: centerSections ? 'center' : 'left' }}>
            {block.text}
          </div>
        )
        if (block.type === 'couplet') return (
          <div key={idx} style={{ marginBottom:10 }}>
            <div style={{ color:GOLD, whiteSpace:'pre-wrap', fontWeight:600, lineHeight:1.3, fontSize }}>{block.chordRow || '\u200B'}</div>
            <div style={{ color:'#F5F0E8', whiteSpace:'pre-wrap', lineHeight:1.5, fontSize }}>{block.lyricRow || '\u200B'}</div>
          </div>
        )
        // lyric
        return <div key={idx} style={{ color:'#999', whiteSpace:'pre-wrap', lineHeight:1.6, marginBottom:2, fontSize }}>{block.text}</div>
      })}
    </div>
  )
}

function parseChordResponse(text) {
  if (!text) return {}
  const t = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim()
  if (t === 'UNKNOWN') return { unknown: true }
  const tempoMatch = t.match(/^TEMPO:\s*(.+)/im)
  const notesMatch = t.match(/^NOTES:\s*(.+)/im)
  const keyMatch = t.match(/^KEY:\s*(.+)/im)
  const chordsLyricsMatch = t.match(/^CHORDS_LYRICS:\s*\n([\s\S]+)/im)
  const chordsMatch = t.match(/^CHORDS:\s*\n([\s\S]+)/im)
  const result = {}
  if (tempoMatch) result.tempo = tempoMatch[1].trim()
  if (notesMatch) result.notes = notesMatch[1].trim()
  if (keyMatch) result.key = keyMatch[1].trim()
  if (chordsLyricsMatch) {
    result.chords = chordsLyricsMatch[1].trim()
  } else if (chordsMatch) {
    result.chords = chordsMatch[1].trim()
  } else if (!tempoMatch && !notesMatch && !keyMatch) {
    result.chords = text.trim()
  }
  return result
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
  { id:'songs', icon:'♪', label:'Songs' },
  { id:'keyfinder', icon:'♭', label:'Key Finder' },
  { id:'patches', icon:'◈', label:'Patches' },
  { id:'add', icon:'+', label:'Add Song' },
  { id:'gig', icon:'▶', label:'Gig' },
  { id:'setlist', icon:'≡', label:'Set List' },
]

const s = {
  app: { display:'flex', flexDirection:'column', height:'100dvh', background:'#080808', overflow:'hidden' },
  header: { padding:'18px 16px 0', background:'#080808', flexShrink:0 },
  scroll: { flex:1, overflowY:'auto', WebkitOverflowScrolling:'touch', paddingBottom:90, overflowX:'hidden' },
  bottomNav: {
    position:'fixed', bottom:0, left:0, right:0,
    background:'rgba(8,8,8,0.97)',
    backdropFilter:'blur(20px)',
    WebkitBackdropFilter:'blur(20px)',
    borderTop:'1px solid #1c1c1c',
    display:'flex', paddingBottom:'env(safe-area-inset-bottom)',
    zIndex:100, height:64,
  },
  navBtn: (active) => ({
    flex:1, display:'flex', flexDirection:'column', alignItems:'center', position:'relative',
    gap:4, padding:'10px 0', background:'none', border:'none', cursor:'pointer',
    color: active ? GOLD : '#555', fontSize:10, fontWeight:500, letterSpacing:'0.06em',
    textTransform:'uppercase', transition:'color 0.15s', fontFamily:'Inter, sans-serif',
  }),
  navIcon: { fontSize:20, lineHeight:1 },
  filterRow: { display:'flex', gap:6, padding:'12px 16px 0', overflowX:'auto', scrollbarWidth:'none', flexShrink:0 },
  filterPill: (active) => ({
    padding:'5px 14px', borderRadius:20,
    border: active ? 'none' : '1px solid #2a2a2a',
    cursor:'pointer', fontSize:11, fontWeight:500, whiteSpace:'nowrap', transition:'all 0.15s',
    background: active ? GOLD : 'transparent',
    color: active ? '#000' : '#666660',
    fontFamily:'Inter, sans-serif', letterSpacing:'0.04em',
  }),
  searchRow: { padding:'10px 12px', flexShrink:0, width:'100%' },
  searchInput: {
    width:'100%', padding:'10px 14px', background:'#0f0f0f',
    border:'1px solid #1c1c1c', borderRadius:8, color:'#F5F0E8',
    fontSize:14, outline:'none', boxSizing:'border-box', display:'block',
    fontFamily:'Inter, sans-serif',
  },
  alphaHeader: { padding:'14px 18px 5px', color:'#3a3a3a', fontSize:9, fontWeight:600, letterSpacing:'0.15em', fontFamily:'Inter, sans-serif', textTransform:'uppercase' },
  card: (expanded, event) => ({
    margin:'0 10px 7px',
    background:'linear-gradient(135deg, #131313, #0f0f0f)',
    border:'1px solid #1c1c1c',
    borderLeft:`3px solid ${GOLD}`,
    borderRadius:14,
    overflow:'hidden',
    transition:'box-shadow 0.2s',
  }),
  cardHeader: { padding:'14px 16px', display:'flex', alignItems:'center', gap:10, cursor:'pointer' },
  cardLeft: { flex:1, minWidth:0 },
  cardName: { fontSize:18, fontWeight:500, color:'#F5F0E8', marginBottom:3, lineHeight:1.2, fontFamily:'Playfair Display, serif' },
  cardArtist: { fontSize:12, color:'#666660', fontFamily:'Inter, sans-serif' },
  cardRight: { display:'flex', alignItems:'center', gap:8, flexShrink:0 },
  keyBadge: {
    background:GOLD_GLOW, color:GOLD, border:`1px solid ${GOLD_DIM}`,
    borderRadius:6, fontSize:12, fontWeight:600, padding:'3px 9px',
    fontFamily:'Inter, sans-serif',
  },
  starBtn: { background:'none', border:'none', cursor:'pointer', fontSize:17, padding:0, lineHeight:1, color:GOLD },
  chevron: (open) => ({
    color:'#444', fontSize:11, transition:'transform 0.2s',
    transform: open ? 'rotate(180deg)' : 'rotate(0deg)', display:'block',
  }),
  evPill: (ev) => {
    const c = EVENT_COLORS[ev] || EVENT_COLORS.all
    return { background:c.bg, color:c.text, border:`1px solid ${c.border}`, borderRadius:4, fontSize:9, fontWeight:600, padding:'2px 7px', letterSpacing:'0.08em', textTransform:'uppercase', fontFamily:'Inter, sans-serif' }
  },
  detail: { borderTop:'1px solid #1c1c1c', padding:'16px', boxSizing:'border-box', width:'100%', overflow:'hidden', background:'#0a0a0a' },
  detailGrid: { display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:12, width:'100%', boxSizing:'border-box' },
  fieldLabel: { fontSize:9, color:'#666660', display:'block', marginBottom:5, fontWeight:500, textTransform:'uppercase', letterSpacing:'0.15em', fontFamily:'Inter, sans-serif' },
  fieldSelect: { width:'100%', padding:'9px 10px', background:'#111', border:'1px solid #1c1c1c', borderRadius:6, color:'#F5F0E8', fontSize:13, boxSizing:'border-box', fontFamily:'Inter, sans-serif' },
  fieldInput: { width:'100%', padding:'9px 10px', background:'#111', border:'1px solid #1c1c1c', borderRadius:6, color:'#F5F0E8', fontSize:13, boxSizing:'border-box', fontFamily:'Inter, sans-serif' },
  fieldTextarea: { width:'100%', padding:'9px 10px', background:'#111', border:'1px solid #1c1c1c', borderRadius:6, color:'#F5F0E8', fontSize:13, resize:'vertical', fontFamily:'inherit', boxSizing:'border-box' },
  chordBox: { width:'100%', padding:'10px 12px', background:'#080808', border:`1px solid ${GOLD_DIM}`, borderRadius:6, color:GOLD, fontSize:13, fontFamily:'monospace', resize:'vertical', minHeight:60, boxSizing:'border-box' },
  deleteBtn: { padding:'8px 16px', background:'none', border:'1px solid #2a2020', borderRadius:4, color:'#c04040', fontSize:12, cursor:'pointer', fontFamily:'Inter, sans-serif', letterSpacing:'0.04em' },
  kfCard: { margin:'12px', background:'linear-gradient(135deg,#111111,#0d0d0d)', border:'1px solid #1c1c1c', borderRadius:14, padding:16, marginBottom:10 },
  kfLabel: { fontSize:9, color:'#666660', fontWeight:500, textTransform:'uppercase', letterSpacing:'0.15em', marginBottom:12, fontFamily:'Inter, sans-serif' },
  kfRow: { display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 },
  kfRowLabel: { fontSize:14, color:'#F5F0E8', fontFamily:'Inter, sans-serif' },
  kfSelect: { padding:'7px 10px', background:'#0f0f0f', border:'1px solid #1c1c1c', borderRadius:6, color:'#F5F0E8', fontSize:13, maxWidth:180, fontFamily:'Inter, sans-serif' },
  kfResult: { margin:'0 12px', background:'linear-gradient(135deg,#111111,#0d0d0d)', border:`1px solid ${GOLD_DIM}`, borderRadius:14, padding:28, textAlign:'center' },
  kfResultKey: { fontSize:72, fontWeight:700, color:GOLD, lineHeight:1, letterSpacing:'-0.04em', fontFamily:'Playfair Display, serif' },
  kfResultSub: { fontSize:9, color:'#666660', marginTop:8, fontFamily:'Inter, sans-serif', textTransform:'uppercase', letterSpacing:'0.15em' },
  kfAlts: { display:'flex', gap:8, justifyContent:'center', marginTop:14, flexWrap:'wrap' },
  kfAlt: { padding:'5px 14px', border:`1px solid ${GOLD_DIM}`, borderRadius:20, color:GOLD, fontSize:13, background:GOLD_GLOW, fontFamily:'Inter, sans-serif' },
  runBtn: { width:'calc(100% - 24px)', margin:'10px 12px', padding:15, background:GOLD, border:'none', borderRadius:4, color:'#000', fontSize:14, fontWeight:600, cursor:'pointer', fontFamily:'Inter, sans-serif', letterSpacing:'0.06em', textTransform:'uppercase' },
  patchSection: { margin:'12px 12px 0' },
  patchSectionLabel: { fontSize:9, color:'#666660', fontWeight:500, textTransform:'uppercase', letterSpacing:'0.15em', marginBottom:10, fontFamily:'Inter, sans-serif' },
  patchGrid: { display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:20 },
  patchCard: { background:'linear-gradient(135deg,#131313,#0f0f0f)', border:'1px solid #1c1c1c', borderRadius:12, padding:12 },
  patchName: { fontSize:13, fontWeight:600, color:'#F5F0E8', marginBottom:3, fontFamily:'Inter, sans-serif' },
  patchSrc: { fontSize:11, color:'#666660', marginBottom:6 },
  patchWhen: { fontSize:11, color:'#444', lineHeight:1.5 },
  empty: { textAlign:'center', padding:'60px 20px', color:'#555', fontSize:15 },
}

function GigMode({ songs, onExit, onSaveKey }) {
  const [idx, setIdx] = useState(0)
  const [offset, setOffset] = useState(0)
  const [keySaved, setKeySaved] = useState(false)
  const [fontSize, setFontSize] = useState(17)
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

  if (!songs.length) return (
    <div style={{ position:'fixed', inset:0, background:'#080808', zIndex:200, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center' }}>
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
      style={{ position:'fixed', inset:0, background:'#080808', zIndex:200, display:'flex', flexDirection:'column', color:'#F5F0E8', userSelect:'none' }}
      onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}
    >
      {/* Top bar: transpose corners + progress */}
      <div style={{ flexShrink:0, paddingTop:'env(safe-area-inset-top)' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 12px 6px' }}>
          <button
            onClick={() => setOffset(o => o - 1)}
            style={{ width:44, height:44, background:'transparent', border:`1px solid ${GOLD_DIM}`, borderRadius:4, color:GOLD, fontSize:26, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}
          >−</button>

          <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:4, flex:1 }}>
            <span style={{ color:'#555', fontSize:9, fontWeight:500, letterSpacing:'0.15em', textTransform:'uppercase', fontFamily:'Inter, sans-serif' }}>
              Song {idx + 1} of {songs.length}
            </span>
            {songs.length <= 12 && (
              <div style={{ display:'flex', gap:4 }}>
                {songs.map((_, i) => (
                  <div key={i} onClick={() => setIdx(i)} style={{ width: i === idx ? 16 : 6, height:4, borderRadius:2, background: i === idx ? GOLD : '#333', cursor:'pointer', transition:'all 0.2s' }} />
                ))}
              </div>
            )}
          </div>

          <button
            onClick={() => setOffset(o => o + 1)}
            style={{ width:44, height:44, background:'transparent', border:`1px solid ${GOLD_DIM}`, borderRadius:4, color:GOLD, fontSize:26, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}
          >+</button>
        </div>

        {/* Second row: exit + key badge + save key */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 16px 12px', borderBottom:'1px solid #1c1c1c' }}>
          <button onClick={onExit} style={{ background:'none', border:'none', color:'#555', fontSize:11, cursor:'pointer', padding:0, letterSpacing:'0.1em', textTransform:'uppercase', fontFamily:'Inter, sans-serif' }}>✕ Exit</button>

          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <span style={{ background:GOLD_GLOW, color:GOLD, border:`1px solid ${GOLD_DIM}`, borderRadius:6, fontSize:22, fontWeight:800, padding:'5px 18px', fontFamily:'Playfair Display, serif' }}>
              {displayKey || '—'}
            </span>
            {offset !== 0 && (
              <span style={{ color:'#666660', fontSize:11, fontFamily:'Inter, sans-serif' }}>{offset > 0 ? `+${offset}` : offset} st</span>
            )}
          </div>

          <button
            onClick={saveKey}
            disabled={!displayKey || !offset}
            style={{ background:'transparent', border:`1px solid ${keySaved ? '#2d4d2d' : (offset ? GOLD_DIM : '#1c1c1c')}`, borderRadius:4, color: keySaved ? '#5a9e5a' : (offset ? GOLD : '#444'), fontSize:11, fontWeight:600, padding:'6px 12px', cursor: offset ? 'pointer' : 'default', transition:'all 0.2s', fontFamily:'Inter, sans-serif', letterSpacing:'0.06em', textTransform:'uppercase' }}>
            {keySaved ? 'Saved ✓' : 'Save key'}
          </button>
        </div>
      </div>

      {/* Scrollable content */}
      <div style={{ flex:1, overflowY:'auto', overflowX:'hidden', WebkitOverflowScrolling:'touch', padding:'24px 24px 32px' }}>
        <div style={{ fontFamily:'Playfair Display, serif', fontSize:52, fontWeight:700, lineHeight:1.1, letterSpacing:'-0.02em', marginBottom:8, color:'#F5F0E8' }}>{song.name}</div>
        {song.artist && <div style={{ fontSize:14, color:'#666660', marginBottom:24, fontFamily:'Inter, sans-serif', letterSpacing:'0.02em' }}>{song.artist}</div>}

        {song.patch && (
          <div style={{ fontSize:12, color:'#555', marginBottom:20, fontStyle:'italic', fontFamily:'Inter, sans-serif' }}>{song.patch}</div>
        )}

        {displayChords
          ? <div style={{ marginBottom:24 }}>
              <div style={{ maxWidth:'90%', margin:'0 auto' }}>
                <ChordLyricDisplay text={displayChords} fontSize={fontSize} centerSections={true} />
              </div>
            </div>
          : <div style={{ color:'#2e2e2e', fontSize:13, fontStyle:'italic', fontFamily:'Inter, sans-serif', marginBottom:24 }}>No chord chart — add chords from the Songs tab.</div>
        }

        {song.notes && (
          <div style={{ color:'#888', fontSize:13, lineHeight:1.7, borderTop:'1px solid #1c1c1c', paddingTop:16, fontFamily:'Inter, sans-serif' }}>{song.notes}</div>
        )}
      </div>

      {/* Bottom nav: prev / tempo+font / next */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 16px', borderTop:'1px solid #1c1c1c', flexShrink:0, paddingBottom:'calc(10px + env(safe-area-inset-bottom))' }}>
        <button
          onClick={prev} disabled={atStart}
          style={{ background:'none', border:`1px solid ${atStart ? '#1c1c1c' : GOLD_DIM}`, borderRadius:4, color: atStart ? '#1c1c1c' : GOLD, fontSize:28, padding:'8px 20px', cursor: atStart ? 'default' : 'pointer', lineHeight:1, transition:'all 0.15s', flexShrink:0 }}
        >‹</button>

        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:5, flex:1, minWidth:0, padding:'0 8px' }}>
          <div style={{ color:'#555', fontSize:10, letterSpacing:'0.08em', textTransform:'uppercase', fontFamily:'Inter, sans-serif', textAlign:'center', lineHeight:1.3 }}>
            {song.tempo || ''}
            {song.bpm && song.tempo && <span style={{ color:'#555', margin:'0 5px' }}>·</span>}
            {song.bpm && <span style={{ color:'#444', textTransform:'none' }}>{song.bpm} bpm</span>}
          </div>
          <div style={{ display:'flex', gap:6, alignItems:'center' }}>
            <button onClick={() => setFontSize(f => Math.max(12, f - 2))}
              style={{ background:'none', border:'1px solid #1c1c1c', borderRadius:4, color:'#555', fontSize:11, padding:'3px 9px', cursor:'pointer', fontFamily:'Inter, sans-serif', lineHeight:1 }}>A−</button>
            <span style={{ color:'#444', fontSize:9, fontFamily:'Inter, sans-serif' }}>{fontSize}px</span>
            <button onClick={() => setFontSize(f => Math.min(30, f + 2))}
              style={{ background:'none', border:'1px solid #1c1c1c', borderRadius:4, color:'#555', fontSize:11, padding:'3px 9px', cursor:'pointer', fontFamily:'Inter, sans-serif', lineHeight:1 }}>A+</button>
          </div>
        </div>

        <button
          onClick={next} disabled={atEnd}
          style={{ background:'none', border:`1px solid ${atEnd ? '#1c1c1c' : GOLD_DIM}`, borderRadius:4, color: atEnd ? '#1c1c1c' : GOLD, fontSize:28, padding:'8px 20px', cursor: atEnd ? 'default' : 'pointer', lineHeight:1, transition:'all 0.15s', flexShrink:0 }}
        >›</button>
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
  const [dragIdx, setDragIdx] = useState(null)
  const [dragOverIdx, setDragOverIdx] = useState(null)
  const dragState = useRef(null)

  useEffect(() => { fetchSetlists() }, [])

  async function fetchSetlists() {
    const { data } = await supabase.from('setlists').select('*, setlist_songs(id)').order('created_at', { ascending: false })
    setSetlists(data || [])
  }

  function fmtDate(d) {
    if (!d) return ''
    const [y, m, day] = d.split('-')
    return new Date(+y, +m - 1, +day).toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' })
  }

  async function openSetlist(sl) {
    setActive(sl)
    setLoadingSlots(true)
    setSongSearch('')
    const { data } = await supabase.from('setlist_songs').select('*, songs(*)').eq('setlist_id', sl.id).order('position')
    setSlots(data || [])
    setLoadingSlots(false)
  }

  async function createSetlist() {
    if (!newName.trim()) return
    const { data, error } = await supabase.from('setlists')
      .insert({ name: newName.trim(), event_type: newEvent, event_date: newDate || null })
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

  async function reorder(fromIdx, toIdx) {
    if (fromIdx === toIdx || toIdx == null) return
    const next = [...slots]
    const [moved] = next.splice(fromIdx, 1)
    next.splice(toIdx, 0, moved)
    setSlots(next)
    setDragIdx(null); setDragOverIdx(null)
    await Promise.all(next.map((s, i) => supabase.from('setlist_songs').update({ position: i }).eq('id', s.id)))
  }

  function onHandleTouchStart(e, idx) {
    e.preventDefault()
    dragState.current = { idx }
    setDragIdx(idx)
  }

  function onListTouchMove(e) {
    if (!dragState.current) return
    const touch = e.touches[0]
    const el = document.elementFromPoint(touch.clientX, touch.clientY)
    const row = el?.closest('[data-slot-idx]')
    if (row) setDragOverIdx(parseInt(row.dataset.slotIdx))
  }

  function onListTouchEnd() {
    if (!dragState.current) return
    reorder(dragState.current.idx, dragOverIdx)
    dragState.current = null
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
    <div style={{ padding:'12px', paddingBottom:90 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
        <div style={{ fontSize:9, fontWeight:600, color:'#666660', textTransform:'uppercase', letterSpacing:'0.15em', fontFamily:'Inter, sans-serif' }}>Set Lists</div>
        <button onClick={() => setCreating(true)}
          style={{ background:'transparent', border:`1px solid ${GOLD_DIM}`, borderRadius:4, color:GOLD, fontSize:12, padding:'6px 14px', cursor:'pointer', fontFamily:'Inter, sans-serif', letterSpacing:'0.04em' }}>+ New</button>
      </div>

      {creating && (
        <div style={{ background:'linear-gradient(135deg,#111111,#0d0d0d)', border:'1px solid #1c1c1c', borderRadius:12, padding:14, marginBottom:12 }}>
          <input autoFocus placeholder="Set list name..." value={newName}
            onChange={e => setNewName(e.target.value)} onKeyDown={e => e.key === 'Enter' && createSetlist()}
            style={{ width:'100%', padding:'9px 10px', background:'#0f0f0f', border:'1px solid #1c1c1c', borderRadius:6, color:'#F5F0E8', fontSize:14, boxSizing:'border-box', marginBottom:10, outline:'none', fontFamily:'Inter, sans-serif' }} />
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:10 }}>
            <select value={newEvent} onChange={e => setNewEvent(e.target.value)}
              style={{ padding:'9px 10px', background:'#0f0f0f', border:'1px solid #1c1c1c', borderRadius:6, color:'#F5F0E8', fontSize:13, boxSizing:'border-box', fontFamily:'Inter, sans-serif' }}>
              <option value="kumzitz">Kumzitz</option>
              <option value="sheva">Sheva Brachos</option>
              <option value="wedding">Wedding</option>
              <option value="all">All events</option>
            </select>
            <input type="date" value={newDate} onChange={e => setNewDate(e.target.value)}
              style={{ padding:'9px 10px', background:'#0f0f0f', border:'1px solid #1c1c1c', borderRadius:6, color:'#F5F0E8', fontSize:13, boxSizing:'border-box', colorScheme:'dark', fontFamily:'Inter, sans-serif' }} />
          </div>
          <div style={{ display:'flex', gap:8 }}>
            <button onClick={createSetlist}
              style={{ flex:1, padding:'9px 0', background:GOLD, border:'none', borderRadius:4, color:'#000', fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:'Inter, sans-serif', letterSpacing:'0.04em' }}>Create</button>
            <button onClick={() => { setCreating(false); setNewName('') }}
              style={{ padding:'9px 14px', background:'none', border:'1px solid #1c1c1c', borderRadius:4, color:'#666660', fontSize:13, cursor:'pointer', fontFamily:'Inter, sans-serif' }}>Cancel</button>
          </div>
        </div>
      )}

      {setlists.length === 0 && !creating && (
        <div style={{ textAlign:'center', padding:'60px 20px', color:'#555', fontSize:14, fontFamily:'Inter, sans-serif' }}>No set lists yet.</div>
      )}
      {setlists.map(sl => (
        <div key={sl.id} onClick={() => openSetlist(sl)}
          style={{ background:'linear-gradient(135deg,#131313,#0f0f0f)', border:'1px solid #1c1c1c', borderLeft:`3px solid ${GOLD}`, borderRadius:14, padding:'13px 16px', marginBottom:8, cursor:'pointer' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <div style={{ minWidth:0, flex:1 }}>
              <div style={{ fontSize:16, fontWeight:500, color:'#F5F0E8', marginBottom:4, fontFamily:'Playfair Display, serif' }}>{sl.name}</div>
              <div style={{ display:'flex', gap:6, alignItems:'center', flexWrap:'wrap' }}>
                <span style={s.evPill(sl.event_type)}>
                  {sl.event_type === 'sheva' ? 'SB' : sl.event_type === 'kumzitz' ? 'KZ' : sl.event_type === 'wedding' ? 'WD' : 'ALL'}
                </span>
                {sl.event_date && <span style={{ color:'#555', fontSize:11, fontFamily:'Inter, sans-serif' }}>{fmtDate(sl.event_date)}</span>}
                <span style={{ color:'#333', fontSize:11, fontFamily:'Inter, sans-serif' }}>{sl.setlist_songs?.length || 0} songs</span>
              </div>
            </div>
            <button onClick={e => deleteSetlist(sl.id, e)}
              style={{ background:'none', border:'none', color:'#444', fontSize:22, cursor:'pointer', padding:'0 4px', lineHeight:1, flexShrink:0 }}>×</button>
          </div>
        </div>
      ))}
    </div>
  )

  return (
    <div style={{ position:'fixed', inset:0, background:'#080808', zIndex:150, display:'flex', flexDirection:'column' }}>
      <div style={{ padding:'12px 14px 10px', borderBottom:'1px solid #1c1c1c', flexShrink:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:6 }}>
          <button onClick={() => setActive(null)}
            style={{ background:'none', border:'none', color:GOLD, fontSize:22, cursor:'pointer', padding:0, lineHeight:1 }}>‹</button>
          <div style={{ flex:1, fontSize:16, fontWeight:500, color:'#F5F0E8', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', fontFamily:'Playfair Display, serif' }}>{active.name}</div>
          <button onClick={() => onPlay(slotSongs)} disabled={slotSongs.length === 0}
            style={{ background: slotSongs.length ? GOLD : '#111', border:'none', borderRadius:4, color: slotSongs.length ? '#000' : '#2e2e2e', fontSize:12, fontWeight:600, padding:'7px 14px', cursor: slotSongs.length ? 'pointer' : 'default', flexShrink:0, fontFamily:'Inter, sans-serif', letterSpacing:'0.04em' }}>
            ▶ Play
          </button>
        </div>
        <div style={{ display:'flex', gap:6, alignItems:'center', paddingLeft:32 }}>
          <span style={s.evPill(active.event_type)}>
            {active.event_type === 'sheva' ? 'SB' : active.event_type === 'kumzitz' ? 'KZ' : active.event_type === 'wedding' ? 'WD' : 'ALL'}
          </span>
          {active.event_date && <span style={{ color:'#555', fontSize:11, fontFamily:'Inter, sans-serif' }}>{fmtDate(active.event_date)}</span>}
          <span style={{ color:'#555', fontSize:11, fontFamily:'Inter, sans-serif' }}>{slots.length} songs</span>
        </div>
      </div>

      <div style={{ flex:1, overflowY:'auto', WebkitOverflowScrolling:'touch' }}>
        <div style={{ padding:'12px', paddingBottom:32 }}>
          <input placeholder="Search songs to add..." value={songSearch}
            onChange={e => setSongSearch(e.target.value)}
            style={{ width:'100%', padding:'9px 12px', background:'#0f0f0f', border:'1px solid #1c1c1c', borderRadius:6, color:'#F5F0E8', fontSize:14, boxSizing:'border-box', outline:'none', fontFamily:'Inter, sans-serif' }}
            autoCorrect="off" autoCapitalize="none" spellCheck={false} />

          {filteredSongs.length > 0 && (
            <div style={{ background:'linear-gradient(135deg,#111111,#0d0d0d)', border:'1px solid #1c1c1c', borderRadius:8, overflow:'hidden', marginTop:4, marginBottom:12 }}>
              {filteredSongs.map((song, i) => (
                <div key={song.id} onClick={() => addSong(song)}
                  style={{ padding:'11px 14px', display:'flex', justifyContent:'space-between', alignItems:'center', borderBottom: i < filteredSongs.length - 1 ? '1px solid #1c1c1c' : 'none', cursor:'pointer' }}>
                  <div style={{ minWidth:0, flex:1 }}>
                    <div style={{ fontSize:14, color:'#F5F0E8', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', fontFamily:'Playfair Display, serif' }}>{song.name}</div>
                    {song.artist && <div style={{ fontSize:11, color:'#666660', fontFamily:'Inter, sans-serif' }}>{song.artist}</div>}
                  </div>
                  <span style={{ color:GOLD, fontSize:20, lineHeight:1, flexShrink:0, marginLeft:8 }}>+</span>
                </div>
              ))}
            </div>
          )}

          {loadingSlots && <div style={{ color:'#555', textAlign:'center', padding:20, fontFamily:'Inter, sans-serif' }}>Loading...</div>}
          {!loadingSlots && slots.length === 0 && (
            <div style={{ color:'#555', textAlign:'center', padding:'40px 0', fontSize:13, fontFamily:'Inter, sans-serif' }}>Search above to add songs.</div>
          )}

          <div onTouchMove={onListTouchMove} onTouchEnd={onListTouchEnd}>
            {slots.map((slot, i) => {
              const song = slot.songs
              const isDragging = dragIdx === i
              const isOver = dragOverIdx === i && dragIdx !== null && dragIdx !== i
              return (
                <div key={slot.id} data-slot-idx={i}
                  draggable
                  onDragStart={() => { setDragIdx(i); setDragOverIdx(null) }}
                  onDragOver={e => { e.preventDefault(); setDragOverIdx(i) }}
                  onDrop={() => reorder(dragIdx, i)}
                  onDragEnd={() => { setDragIdx(null); setDragOverIdx(null) }}
                  style={{
                    display:'flex', alignItems:'center', gap:10,
                    padding:'11px 10px', marginBottom:4,
                    background: isOver ? GOLD_GLOW : 'linear-gradient(135deg,#131313,#0f0f0f)',
                    border:`1px solid ${isOver ? GOLD_DIM : '#1c1c1c'}`,
                    borderRadius:8,
                    opacity: isDragging ? 0.35 : 1,
                    transition:'background 0.1s, border-color 0.1s, opacity 0.1s',
                  }}>
                  <span style={{ color:'#444', fontSize:11, fontVariantNumeric:'tabular-nums', minWidth:18, textAlign:'right', fontFamily:'Inter, sans-serif' }}>{i + 1}</span>
                  <span onTouchStart={e => onHandleTouchStart(e, i)}
                    style={{ color:'#444', fontSize:16, cursor:'grab', touchAction:'none', userSelect:'none', paddingRight:2 }}>⠿</span>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:14, color:'#F5F0E8', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', fontFamily:'Playfair Display, serif' }}>{song?.name}</div>
                    {song?.artist && <div style={{ fontSize:11, color:'#666660', fontFamily:'Inter, sans-serif' }}>{song.artist}</div>}
                  </div>
                  {song?.key && <span style={s.keyBadge}>{song.key}</span>}
                  <button onClick={() => removeSong(slot.id)}
                    style={{ background:'none', border:'none', color:'#444', fontSize:22, cursor:'pointer', padding:'0 2px', lineHeight:1, flexShrink:0 }}>×</button>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

function inp2() {
  return { width:'100%', padding:'9px 10px', background:'#0f0f0f', border:'1px solid #1c1c1c', borderRadius:6, color:'#F5F0E8', fontSize:13, boxSizing:'border-box', fontFamily:'Inter, sans-serif' }
}

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

  async function searchChords() {
    if (!name.trim()) return
    setAiLoading(true)
    try {
      const res = await fetch('/api/chords', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ songName: name, artist, key })
      })
      const data = await res.json()
      const parsed = parseChordResponse(data.text || '')
      if (parsed.unknown) { setAiLoading(false); return }
      if (parsed.tempo) setTempo(parsed.tempo)
      if (parsed.notes) setNotes(parsed.notes)
      if (parsed.chords) setChords(parsed.chords)
      if (parsed.key) setKey(parsed.key)
    } catch(e) { console.error(e) }
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
        const res = await fetch('/api/chords', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ songName: name, artist, key })
        })
        const data = await res.json()
        const parsed = parseChordResponse(data.text || '')
        if (!parsed.unknown) {
          if (parsed.tempo) finalTempo = parsed.tempo
          if (parsed.notes) finalNotes = parsed.notes
          if (parsed.chords) finalChords = parsed.chords
          if (parsed.key) finalKey = parsed.key
        }
      } catch(e) { console.error(e) }
      setAiLoading(false)
    }

    const { error } = await supabase.from('songs').insert({
      name: name.trim(), artist: artist.trim(), key: finalKey, event_type: event,
      patch, chords: finalChords, notes: finalNotes, tempo: finalTempo,
      tags: tags.trim() || null, bpm: bpm ? parseInt(bpm) : null
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
    <div style={{ padding:'16px', paddingBottom:90 }}>
      <div style={{ fontSize:9, fontWeight:600, color:'#666660', marginBottom:16, textTransform:'uppercase', letterSpacing:'0.15em', fontFamily:'Inter, sans-serif' }}>Add Song</div>

      <div style={{ background:'linear-gradient(135deg,#111111,#0d0d0d)', border:'1px solid #1c1c1c', borderLeft:`3px solid ${GOLD}`, borderRadius:14, padding:14, marginBottom:12 }}>
        <div style={{ fontSize:9, color:'#666660', fontWeight:500, textTransform:'uppercase', letterSpacing:'0.15em', marginBottom:12, fontFamily:'Inter, sans-serif' }}>Song Info</div>
        {[
          ['Song name', <input key="name" value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. Od Yishama" style={inp2()} autoFocus autoCorrect="off" autoCapitalize="words" spellCheck={false} />],
          ['Artist', <input key="artist" value={artist} onChange={e=>setArtist(e.target.value)} placeholder="e.g. MBD, Traditional..." style={inp2()} autoCorrect="off" autoCapitalize="words" spellCheck={false} />],
        ].map(([label, input]) => (
          <div key={label} style={{ marginBottom:10 }}>
            <label style={{ fontSize:9, color:'#666660', display:'block', marginBottom:4, textTransform:'uppercase', letterSpacing:'0.15em', fontFamily:'Inter, sans-serif' }}>{label}</label>
            {input}
          </div>
        ))}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
          <div>
            <label style={{ fontSize:11, color:'#555', display:'block', marginBottom:4, textTransform:'uppercase', letterSpacing:'0.06em' }}>Key</label>
            <select value={key} onChange={e=>setKey(e.target.value)} style={inp2()}>
              {KEYS.map(k=><option key={k}>{k}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize:11, color:'#555', display:'block', marginBottom:4, textTransform:'uppercase', letterSpacing:'0.06em' }}>Event</label>
            <select value={event} onChange={e=>setEvent(e.target.value)} style={inp2()}>
              <option value="kumzitz">Kumzitz</option>
              <option value="sheva">Sheva Brachos</option>
              <option value="wedding">Wedding</option>
              <option value="all">All events</option>
            </select>
          </div>
          <div style={{ gridColumn:'1/-1' }}>
            <label style={{ fontSize:11, color:'#555', display:'block', marginBottom:4, textTransform:'uppercase', letterSpacing:'0.06em' }}>Patch</label>
            <select value={patch} onChange={e=>setPatch(e.target.value)} style={inp2()}>
              {PATCHES.map(p=><option key={p}>{p}</option>)}
            </select>
          </div>
          <div style={{ gridColumn:'1/-1' }}>
            <label style={{ fontSize:11, color:'#555', display:'block', marginBottom:4, textTransform:'uppercase', letterSpacing:'0.06em' }}>Tempo</label>
            <input value={tempo} onChange={e=>setTempo(e.target.value)} placeholder="e.g. Slow, Upbeat..." style={inp2()} />
          </div>
          <div>
            <label style={{ fontSize:11, color:'#555', display:'block', marginBottom:4, textTransform:'uppercase', letterSpacing:'0.06em' }}>BPM</label>
            <input type="number" value={bpm} onChange={e=>setBpm(e.target.value)} placeholder="e.g. 72" style={inp2()} />
          </div>
          <div>
            <label style={{ fontSize:11, color:'#555', display:'block', marginBottom:4, textTransform:'uppercase', letterSpacing:'0.06em' }}>Tags</label>
            <input value={tags} onChange={e=>setTags(e.target.value)} placeholder="e.g. slow, niggun" style={inp2()} />
          </div>
        </div>
      </div>

      <div style={{ background:'linear-gradient(135deg,#111111,#0d0d0d)', border:'1px solid #1c1c1c', borderLeft:`3px solid ${GOLD}`, borderRadius:14, padding:14, marginBottom:12 }}>
        <div style={{ fontSize:9, color:'#666660', fontWeight:500, textTransform:'uppercase', letterSpacing:'0.15em', marginBottom:12, fontFamily:'Inter, sans-serif' }}>Find Chords</div>
        <div style={{ display:'flex', gap:8, marginBottom:12 }}>
          <button onClick={searchChords} disabled={aiLoading || !name.trim()} style={{
            flex:1, padding:'11px 0', background:'transparent',
            border:`1px solid ${aiLoading || !name.trim() ? '#1c1c1c' : GOLD_DIM}`, borderRadius:4,
            color: aiLoading || !name.trim() ? '#2e2e2e' : GOLD,
            fontSize:12, fontWeight:600, cursor: name.trim() ? 'pointer' : 'not-allowed',
            fontFamily:'Inter, sans-serif', letterSpacing:'0.06em', textTransform:'uppercase',
          }}>
            {aiLoading ? 'Searching...' : '✦ Search Chords'}
          </button>
          <a href={googleUrl} target="_blank" rel="noopener noreferrer" style={{
            flex:1, padding:'11px 0', background:'transparent',
            border:'1px solid #1c1c1c', borderRadius:4, color:'#444',
            fontSize:12, fontWeight:600, textDecoration:'none', textAlign:'center', display:'block',
            fontFamily:'Inter, sans-serif', letterSpacing:'0.04em', textTransform:'uppercase',
          }}>⌕ Google</a>
        </div>
        <label style={{ fontSize:9, color:'#666660', display:'block', marginBottom:6, textTransform:'uppercase', letterSpacing:'0.15em', fontFamily:'Inter, sans-serif' }}>Chords</label>
        {chords && isChordLyricFormat(chords) && (
          <div style={{ background:'#080808', border:`1px solid ${GOLD_DIM}`, borderRadius:6, padding:'10px 12px', marginBottom:8, overflowX:'auto' }}>
            <ChordLyricDisplay text={chords} fontSize={13} />
          </div>
        )}
        <textarea
          value={chords} onChange={e=>setChords(e.target.value)}
          placeholder={'Intro: Dm | Gm | A7 | Dm\nVerse: Dm | Gm | Dm | A7\nChorus: F | Bb | C | Dm'}
          rows={4}
          style={{ width:'100%', padding:'10px 12px', background:'#080808', border:`1px solid ${GOLD_DIM}`, borderRadius:6, color:GOLD, fontSize:13, fontFamily:'monospace', resize:'vertical', boxSizing:'border-box' }}
        />
        <label style={{ fontSize:9, color:'#666660', display:'block', marginBottom:6, marginTop:10, textTransform:'uppercase', letterSpacing:'0.15em', fontFamily:'Inter, sans-serif' }}>Performance notes</label>
        <textarea
          value={notes} onChange={e=>setNotes(e.target.value)}
          placeholder="Tips, energy arc, watch-outs..."
          rows={2}
          style={{ width:'100%', padding:'10px 12px', background:'#0f0f0f', border:'1px solid #1c1c1c', borderRadius:6, color:'#F5F0E8', fontSize:13, resize:'vertical', boxSizing:'border-box', fontFamily:'Inter, sans-serif' }}
        />
      </div>

      <button onClick={save} disabled={saving || aiLoading || !name.trim()} style={{
        width:'100%', padding:15, background: name.trim() && !saving && !aiLoading ? GOLD : '#111',
        border:'none', borderRadius:4, color: name.trim() && !saving && !aiLoading ? '#000' : '#2e2e2e',
        fontSize:14, fontWeight:600, cursor: name.trim() && !saving && !aiLoading ? 'pointer' : 'not-allowed',
        fontFamily:'Inter, sans-serif', letterSpacing:'0.08em', textTransform:'uppercase',
      }}>
        {saving || aiLoading ? 'Saving...' : 'Save song'}
      </button>
    </div>
  )
}

export default function App() {
  const [tab, setTab] = useState('songs')
  const [songs, setSongs] = useState([])
  const [loading, setLoading] = useState(true)
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

  // Fill-all state
  const [fillAllConfirm, setFillAllConfirm] = useState(false)
  const [fillAllRunning, setFillAllRunning] = useState(false)
  const [fillAllProgress, setFillAllProgress] = useState({ done: 0, total: 0 })
  const fillAllAbort = useRef(false)

  // Expanded card local state for key/chords (supports transpose flow)
  const [xKey, setXKey] = useState('D')         // what's in the dropdown
  const [xChordsKey, setXChordsKey] = useState('D') // what key the chords are currently in
  const [xChords, setXChords] = useState('')     // chord text (may be locally transposed)
  const [xSaving, setXSaving] = useState(false)
  const [xSaved, setXSaved] = useState(false)

  const [kfCrowd, setKfCrowd] = useState('mixed')
  const [kfComfort, setKfComfort] = useState('medium')
  const [kfHasSinger, setKfHasSinger] = useState(false)
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

  useEffect(() => { fetchSongs() }, [])

  // Sync expanded card state when a different song is expanded
  useEffect(() => {
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
    const { data, error } = await supabase.from('songs').select('*').order('created_at', { ascending: true })
    if (!error) setSongs(data || [])
    setLoading(false)
  }

  async function updateSong(id, field, value) {
    await supabase.from('songs').update({ [field]: value }).eq('id', id)
    setSongs(prev => prev.map(s => s.id === id ? { ...s, [field]: value } : s))
  }

  async function fillWithGemini(song) {
    setAiLoadingId(song.id)
    setAiError('')
    try {
      const res = await fetch('/api/chords', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ songName: song.name, artist: song.artist, key: song.key })
      })
      const data = await res.json()
      if (!res.ok) {
        setAiError(data.error || 'Chord search failed')
        setAiLoadingId(null)
        return
      }
      const text = data.text || ''
      if (text.trim() === 'UNKNOWN') { setAiLoadingId(null); return }
      const parsed = parseChordResponse(text)
      const updates = {}
      if (parsed.tempo) updates.tempo = parsed.tempo
      if (parsed.notes) updates.notes = parsed.notes
      if (parsed.chords) updates.chords = parsed.chords
      if (parsed.key) updates.key = parsed.key
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
    } catch(e) { console.error(e) }
    setAiLoadingId(null)
  }

  async function fillAllMissing() {
    const missing = songs.filter(s => !s.chords?.trim())
    if (!missing.length) return
    setFillAllConfirm(false)
    setFillAllRunning(true)
    fillAllAbort.current = false
    setFillAllProgress({ done: 0, total: missing.length })
    for (let i = 0; i < missing.length; i++) {
      if (fillAllAbort.current) break
      const song = missing[i]
      try {
        const res = await fetch('/api/chords', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ songName: song.name, artist: song.artist, key: song.key })
        })
        const data = await res.json()
        const parsed = parseChordResponse(data.text || '')
        if (!parsed.unknown) {
          const updates = {}
          if (parsed.tempo) updates.tempo = parsed.tempo
          if (parsed.notes) updates.notes = parsed.notes
          if (parsed.chords) updates.chords = parsed.chords
          if (parsed.key) updates.key = parsed.key
          if (Object.keys(updates).length) {
            await supabase.from('songs').update(updates).eq('id', song.id)
            setSongs(prev => prev.map(s => s.id === song.id ? { ...s, ...updates } : s))
          }
        }
      } catch(e) { console.error('fill error:', song.name, e) }
      setFillAllProgress({ done: i + 1, total: missing.length })
      if (i < missing.length - 1 && !fillAllAbort.current) {
        await new Promise(r => setTimeout(r, 1000))
      }
    }
    setFillAllRunning(false)
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
    return (
      <div key={song.id} style={s.card(isExpanded, song.event_type)}>
        <div style={s.cardHeader} onClick={() => { setExpandedId(isExpanded ? null : song.id); setDeleteConfirmId(null) }}>
          <div style={s.cardLeft}>
            <div style={s.cardName}>{song.name}</div>
            <div style={s.cardArtist}>{song.artist || <span style={{color:'#333'}}>—</span>}</div>
          </div>
          <div style={s.cardRight}>
            <span style={s.evPill(song.event_type)}>
              {song.event_type === 'sheva' ? 'SB' : song.event_type === 'kumzitz' ? 'KZ' : song.event_type === 'wedding' ? 'WD' : 'ALL'}
            </span>
            {song.key && <span style={s.keyBadge}>{song.key}</span>}
            <button style={s.starBtn} onClick={e => { e.stopPropagation(); updateSong(song.id, 'is_favorite', !song.is_favorite) }}>
              {song.is_favorite ? '★' : '☆'}
            </button>
            <span style={s.chevron(isExpanded)}>▼</span>
          </div>
        </div>
        {isExpanded && (
          <div style={s.detail}>
            <div style={s.detailGrid}>
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
                    style={{ padding:'0 10px', background:'transparent', border:`1px solid ${xKey !== xChordsKey ? GOLD_DIM : '#1c1c1c'}`, borderRadius:4, color: xKey !== xChordsKey ? GOLD : '#2e2e2e', fontSize:11, fontWeight:600, cursor: xKey !== xChordsKey ? 'pointer' : 'default', whiteSpace:'nowrap', flexShrink:0, fontFamily:'Inter, sans-serif', letterSpacing:'0.06em', height:36 }}>
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
                <input defaultValue={song.tempo||''} onBlur={e => updateSong(song.id,'tempo',e.target.value)} placeholder="e.g. Slow build..." style={s.fieldInput} />
              </div>
              <div>
                <label style={s.fieldLabel}>BPM</label>
                <input type="number" defaultValue={song.bpm||''} onBlur={e => updateSong(song.id,'bpm', e.target.value ? parseInt(e.target.value) : null)} placeholder="e.g. 72" style={s.fieldInput} />
              </div>
              <div style={{gridColumn:'1/-1'}}>
                <label style={s.fieldLabel}>Tags</label>
                <input defaultValue={song.tags||''} onBlur={e => updateSong(song.id,'tags', e.target.value || null)} placeholder="e.g. slow, niggun, shabbos" style={s.fieldInput} />
              </div>
            </div>

            <div style={{marginBottom:10}}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
                <span style={{ ...s.fieldLabel, marginBottom:0, display:'inline' }}>Chords</span>
                <button onClick={() => fillWithGemini(song)} disabled={aiLoadingId === song.id}
                  style={{ background:'transparent', border:`1px solid ${aiLoadingId === song.id ? '#1c1c1c' : GOLD_DIM}`, borderRadius:4, color: aiLoadingId === song.id ? '#2e2e2e' : GOLD, fontSize:10, fontWeight:600, padding:'3px 8px', cursor: aiLoadingId === song.id ? 'default' : 'pointer', fontFamily:'Inter, sans-serif', letterSpacing:'0.06em', textTransform:'uppercase' }}>
                  {aiLoadingId === song.id ? 'Searching...' : '✦ Fill with Chords'}
                </button>
              </div>
              {aiError && expandedId === song.id && (
                <div style={{ fontSize:11, color:'#c04040', fontFamily:'Inter, sans-serif', marginBottom:6, lineHeight:1.5 }}>{aiError}</div>
              )}
              {xChords && isChordLyricFormat(xChords) && (
                <div style={{ background:'#080808', border:`1px solid ${GOLD_DIM}`, borderRadius:6, padding:'12px 14px', marginBottom:8, overflowX:'auto' }}>
                  <ChordLyricDisplay text={xChords} fontSize={13} />
                </div>
              )}
              <textarea
                value={xChords}
                onChange={e => { setXChords(e.target.value); setXSaved(false) }}
                rows={isChordLyricFormat(xChords) ? 3 : 4}
                placeholder="Chords will appear here..."
                style={s.chordBox}
              />
            </div>

            <div style={{marginBottom:14}}>
              <label style={s.fieldLabel}>Notes</label>
              <textarea defaultValue={song.notes||''} onBlur={e => updateSong(song.id,'notes',e.target.value)} rows={2} style={s.fieldTextarea} />
            </div>

            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:8 }}>
              <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
                <button
                  onClick={() => { setGigSongs([song]); setGigReturnTab('songs'); setTab('gig') }}
                  style={{ padding:'8px 12px', background:'transparent', border:`1px solid ${GOLD_DIM}`, borderRadius:4, color:GOLD, fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'Inter, sans-serif', letterSpacing:'0.04em' }}>
                  ▶ Play
                </button>
                {deleteConfirmId === song.id
                  ? <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                      <span style={{ fontSize:11, color:'#c04040', fontFamily:'Inter, sans-serif' }}>Delete?</span>
                      <button onClick={() => { deleteSong(song.id); setDeleteConfirmId(null) }} style={{ padding:'6px 10px', background:'none', border:'1px solid #c04040', borderRadius:4, color:'#c04040', fontSize:12, cursor:'pointer', fontFamily:'Inter, sans-serif' }}>Yes</button>
                      <button onClick={() => setDeleteConfirmId(null)} style={{ padding:'6px 8px', background:'none', border:'1px solid #1c1c1c', borderRadius:4, color:'#555', fontSize:12, cursor:'pointer', fontFamily:'Inter, sans-serif' }}>No</button>
                    </div>
                  : <button onClick={() => setDeleteConfirmId(song.id)} style={s.deleteBtn}>Remove</button>
                }
              </div>
              <button
                onClick={() => saveExpandedCard(song.id)}
                disabled={xSaving}
                style={{ flexShrink:0, padding:'8px 16px', background: xSaved ? 'transparent' : GOLD, border: xSaved ? '1px solid #2d4d2d' : 'none', borderRadius:4, color: xSaved ? '#5a9e5a' : '#000', fontSize:12, fontWeight:600, cursor:'pointer', transition:'all 0.2s', fontFamily:'Inter, sans-serif', letterSpacing:'0.06em', textTransform:'uppercase' }}>
                {xSaved ? 'Saved ✓' : xSaving ? 'Saving...' : 'Save changes'}
              </button>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div style={s.app}>
      <div style={s.header}>
        <div style={{ paddingBottom:14 }}>
          <div style={{ display:'flex', alignItems:'center', gap:0 }}>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink:0 }}>
                <line x1="0" y1="4" x2="11" y2="4" stroke={GOLD} strokeWidth="0.75"/>
                <line x1="0" y1="7.5" x2="11" y2="7.5" stroke={GOLD} strokeWidth="0.75"/>
                <line x1="0" y1="11" x2="11" y2="11" stroke={GOLD} strokeWidth="0.75"/>
                <line x1="10" y1="3.5" x2="10" y2="11.5" stroke={GOLD} strokeWidth="1"/>
                <ellipse cx="8.3" cy="12" rx="2.3" ry="1.5" fill={GOLD} transform="rotate(-15 8.3 12)"/>
              </svg>
              <span style={{ fontFamily:'Playfair Display, serif', fontStyle:'italic', fontSize:26, fontWeight:700, color:'#F5F0E8', letterSpacing:'-0.01em', lineHeight:1 }}>Corda</span>
            </div>
            <div style={{ flex:1, height:1, background:`linear-gradient(90deg, ${GOLD_DIM}, transparent)`, marginLeft:12, alignSelf:'center' }} />
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:10, marginTop:5 }}>
            <span style={{ fontFamily:'Inter, sans-serif', fontSize:9, fontWeight:500, textTransform:'uppercase', letterSpacing:'0.2em', color:GOLD }}>performance library</span>
            {songs.length > 0 && <span style={{ fontFamily:'Inter, sans-serif', fontSize:9, color:'#555', letterSpacing:'0.06em' }}>· {songs.length} songs</span>}
          </div>
        </div>
      </div>

      <div style={s.scroll}>

        {tab === 'songs' && <>
          <div style={s.filterRow}>
            {['all','kumzitz','sheva','wedding'].map(ev => (
              <button key={ev} style={s.filterPill(eventFilter === ev)} onClick={() => setEventFilter(ev)}>
                {ev === 'all' ? 'All' : ev === 'sheva' ? 'Sheva Brachos' : ev.charAt(0).toUpperCase() + ev.slice(1)}
              </button>
            ))}
            <button style={s.filterPill(favFilter)} onClick={() => setFavFilter(f => !f)}>★ Favorites</button>
          </div>
          <div style={{ ...s.searchRow, display:'flex', gap:8, alignItems:'center' }}>
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search songs or artist..." style={{ ...s.searchInput, width:'auto', flex:1 }}
              autoCorrect="off" autoCapitalize="none" spellCheck={false} />
            <button
              onClick={() => { setGigSongs(filtered); setGigReturnTab('songs'); setTab('gig') }}
              disabled={filtered.length === 0}
              title="Open filtered songs in Gig Mode"
              style={{ flexShrink:0, padding:'9px 12px', background:'transparent', border:`1px solid ${filtered.length ? GOLD_DIM : '#1c1c1c'}`, borderRadius:8, color: filtered.length ? GOLD : '#2e2e2e', fontSize:14, cursor: filtered.length ? 'pointer' : 'default', lineHeight:1 }}>
              ▶
            </button>
          </div>

          {allTags.length > 0 && (
            <div style={{ display:'flex', gap:6, padding:'0 16px 6px', overflowX:'auto', scrollbarWidth:'none', flexShrink:0 }}>
              {allTags.map(tag => (
                <button key={tag} style={s.filterPill(tagFilter === tag)} onClick={() => setTagFilter(tagFilter === tag ? '' : tag)}>
                  #{tag}
                </button>
              ))}
            </div>
          )}

          {/* Filtered count — show when any filter is active */}
          {!loading && (search || eventFilter !== 'all' || favFilter || tagFilter) && (
            <div style={{ padding:'4px 16px 2px', display:'flex', alignItems:'center', gap:8 }}>
              <span style={{ fontSize:10, color:'#444', fontFamily:'Inter, sans-serif', letterSpacing:'0.06em' }}>
                {filtered.length} song{filtered.length !== 1 ? 's' : ''}
              </span>
              {(search || eventFilter !== 'all' || favFilter || tagFilter) && (
                <button onClick={() => { setSearch(''); setEventFilter('all'); setFavFilter(false); setTagFilter('') }}
                  style={{ background:'none', border:'none', color:'#444', fontSize:10, cursor:'pointer', fontFamily:'Inter, sans-serif', padding:0, textDecoration:'underline', textUnderlineOffset:2 }}>
                  Clear filters
                </button>
              )}
            </div>
          )}

          {/* Fill all missing chords bar */}
          {!loading && (() => {
            const missingCount = songs.filter(s => !s.chords?.trim()).length
            if (fillAllRunning) {
              return (
                <div style={{ margin:'0 12px 8px', background:GOLD_GLOW, border:`1px solid ${GOLD_DIM}`, borderRadius:8, padding:'10px 14px', display:'flex', alignItems:'center', justifyContent:'space-between', gap:10 }}>
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
                    style={{ background:'none', border:'1px solid #1c1c1c', borderRadius:4, color:'#444', fontSize:11, padding:'5px 10px', cursor:'pointer', flexShrink:0, fontFamily:'Inter, sans-serif' }}>
                    Cancel
                  </button>
                </div>
              )
            }
            if (missingCount === 0) return null
            return (
              <div style={{ margin:'0 12px 8px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                <span style={{ color:'#666660', fontSize:11, fontFamily:'Inter, sans-serif' }}>{missingCount} song{missingCount !== 1 ? 's' : ''} missing chords</span>
                <button
                  onClick={() => setFillAllConfirm(true)}
                  style={{ background:'transparent', border:`1px solid ${GOLD_DIM}`, borderRadius:4, color:GOLD, fontSize:11, fontWeight:600, padding:'5px 12px', cursor:'pointer', fontFamily:'Inter, sans-serif', letterSpacing:'0.06em' }}>
                  ✦ Fill all missing
                </button>
              </div>
            )
          })()}

          {loading
            ? <div style={s.empty}>Loading...</div>
            : filtered.length === 0
            ? <div style={s.empty}>No songs yet.</div>
            : alphaGroups.map(({ letter, songs: groupSongs }) => (
                <div key={letter}>
                  <div style={s.alphaHeader}>{letter}</div>
                  {groupSongs.map(song => renderSongCard(song))}
                </div>
              ))
          }
        </>}

        {tab === 'keyfinder' && <>
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
                    localStorage.setItem('corda_singer_profile', JSON.stringify({ voice: kfVoice, topNote: kfTopNote, songRange: kfSongRange }))
                    setKfProfileSaved(true)
                    setTimeout(() => setKfProfileSaved(false), 2000)
                  }}
                  style={{ flex:1, padding:'8px 0', background:'transparent', border:`1px solid ${kfProfileSaved ? '#2d4d2d' : GOLD_DIM}`, borderRadius:4, color: kfProfileSaved ? '#5a9e5a' : GOLD, fontSize:11, fontWeight:500, cursor:'pointer', transition:'all 0.2s', fontFamily:'Inter, sans-serif', letterSpacing:'0.06em' }}>
                  {kfProfileSaved ? 'Saved ✓' : 'Save singer profile'}
                </button>
                <button
                  onClick={() => {
                    localStorage.removeItem('corda_singer_profile')
                    setKfVoice('baritone')
                    setKfTopNote('A4')
                    setKfSongRange('medium')
                  }}
                  style={{ padding:'8px 12px', background:'transparent', border:'1px solid #1c1c1c', borderRadius:4, color:'#444', fontSize:11, fontWeight:500, cursor:'pointer', fontFamily:'Inter, sans-serif' }}>
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
                  <div style={{ margin:'8px 12px 0', background:'linear-gradient(135deg,#111111,#0d0d0d)', border:`1px solid ${GOLD_DIM}`, borderRadius:14, padding:14 }}>
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
                        placeholder="Search songs..."
                        style={{ width:'100%', padding:'9px 10px', background:'#0f0f0f', border:'1px solid #1c1c1c', borderRadius:6, color:'#F5F0E8', fontSize:13, boxSizing:'border-box', outline:'none', fontFamily:'Inter, sans-serif' }}
                        autoCorrect="off" autoCapitalize="none" spellCheck={false}
                      />

                      {/* Dropdown results */}
                      {kfSongDropdown && searchResults.length > 0 && (
                        <div style={{ position:'absolute', top:'100%', left:0, right:0, background:'#111', border:'1px solid #1c1c1c', borderRadius:6, marginTop:4, overflow:'hidden', zIndex:10 }}>
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
                                <div style={{ color:'#F5F0E8', fontSize:13, fontFamily:'Playfair Display, serif' }}>{song.name}</div>
                                {song.artist && <div style={{ color:'#666660', fontSize:11, marginTop:1, fontFamily:'Inter, sans-serif' }}>{song.artist}</div>}
                              </div>
                              {song.key && <span style={s.keyBadge}>{song.key}</span>}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Selected song confirmation row */}
                    {selectedSong && (
                      <div style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 10px', background:'#080808', borderRadius:6, marginBottom:8 }}>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ color:'#F5F0E8', fontSize:13, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', fontFamily:'Playfair Display, serif' }}>{selectedSong.name}</div>
                          {selectedSong.artist && <div style={{ color:'#666660', fontSize:11, fontFamily:'Inter, sans-serif' }}>{selectedSong.artist}</div>}
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
                      style={{ width:'100%', padding:'11px 0', background: kfApplied ? 'transparent' : (!kfApplySongId ? 'transparent' : GOLD), border: kfApplied ? '1px solid #2d4d2d' : `1px solid ${!kfApplySongId ? '#1c1c1c' : GOLD}`, borderRadius:4, color: kfApplied ? '#5a9e5a' : (!kfApplySongId ? '#2e2e2e' : '#000'), fontSize:13, fontWeight:600, cursor: kfApplySongId && !kfApplied ? 'pointer' : 'default', boxSizing:'border-box', transition:'all 0.2s', fontFamily:'Inter, sans-serif', letterSpacing:'0.06em', textTransform:'uppercase' }}>
                      {kfApplied ? `Applied ${kfResult.key} ✓` : 'Apply key'}
                    </button>
                  </div>
                )
              })()}
            </>
          )}
        </>}

        {tab === 'patches' && <>
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
            <div key={sec.label} style={s.patchSection}>
              <div style={s.patchSectionLabel}>{sec.label}</div>
              <div style={s.patchGrid}>
                {sec.items.map(p => (
                  <div key={p.name} style={s.patchCard}>
                    <div style={s.patchName}>{p.name}</div>
                    <div style={s.patchSrc}>{p.src}</div>
                    <div style={s.patchWhen}>{p.when}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </>}

        {tab === 'add' && <AddSongTab onSaved={async () => { await fetchSongs(); setTab('songs') }} />}

        {tab === 'setlist' && (
          <SetListBuilder
            songs={songs}
            onPlay={setlistSongs => { setGigSongs(setlistSongs); setGigReturnTab('setlist'); setTab('gig') }}
          />
        )}

      </div>

      <div style={s.bottomNav}>
        {TABS.map(t => (
          <button key={t.id} style={s.navBtn(tab === t.id)}
            onClick={() => { if (t.id === 'gig') { setGigSongs(null); setGigReturnTab('songs') } setTab(t.id) }}>
            {tab === t.id && <div style={{ position:'absolute', top:0, left:'50%', transform:'translateX(-50%)', width:20, height:2, background:GOLD, borderRadius:1 }} />}
            <span style={s.navIcon}>{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'gig' && <GigMode songs={gigSongs || songs} onExit={() => { setGigSongs(null); setTab(gigReturnTab) }} onSaveKey={(id, key) => updateSong(id, 'key', key)} />}

      {/* Fill-all confirmation dialog */}
      {fillAllConfirm && (() => {
        const missingCount = songs.filter(s => !s.chords?.trim()).length
        return (
          <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.8)', zIndex:300, display:'flex', alignItems:'center', justifyContent:'center', padding:24 }}
            onClick={() => setFillAllConfirm(false)}>
            <div style={{ background:'#111', border:`1px solid ${GOLD_DIM}`, borderRadius:12, padding:24, maxWidth:320, width:'100%' }}
              onClick={e => e.stopPropagation()}>
              <div style={{ fontSize:18, fontWeight:500, color:'#F5F0E8', marginBottom:8, fontFamily:'Playfair Display, serif' }}>Fill all missing chords?</div>
              <div style={{ fontSize:13, color:'#666660', lineHeight:1.7, marginBottom:20, fontFamily:'Inter, sans-serif' }}>
                This will search for chords and lyrics for <strong style={{ color:'#F5F0E8' }}>{missingCount} song{missingCount !== 1 ? 's' : ''}</strong> using Gemini with web search. Requests are sent one at a time with a 1-second delay.
              </div>
              <div style={{ display:'flex', gap:10 }}>
                <button onClick={() => setFillAllConfirm(false)}
                  style={{ flex:1, padding:'10px 0', background:'transparent', border:'1px solid #1c1c1c', borderRadius:4, color:'#444', fontSize:13, cursor:'pointer', fontFamily:'Inter, sans-serif' }}>
                  Cancel
                </button>
                <button onClick={fillAllMissing}
                  style={{ flex:2, padding:'10px 0', background:GOLD, border:'none', borderRadius:4, color:'#000', fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:'Inter, sans-serif', letterSpacing:'0.04em' }}>
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
