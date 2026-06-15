import { useState, useEffect, useRef } from 'react'
import { supabase } from './supabase'

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
  kumzitz: { bg:'#1a2e1a', text:'#6fcf6f', border:'#2d4d2d' },
  sheva:   { bg:'#1e1a33', text:'#a78bfa', border:'#2d2550' },
  wedding: { bg:'#2e2010', text:'#f6a93b', border:'#4a3010' },
  all:     { bg:'#1e1e1e', text:'#888', border:'#333' },
}
const EVENT_ACCENT = {
  kumzitz:'#6fcf6f', sheva:'#a78bfa', wedding:'#f6a93b', all:'#555'
}

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

const TABS = [
  { id:'songs', icon:'♪', label:'Songs' },
  { id:'keyfinder', icon:'♭', label:'Key Finder' },
  { id:'patches', icon:'◈', label:'Patches' },
  { id:'add', icon:'+', label:'Add Song' },
  { id:'gig', icon:'▶', label:'Gig' },
  { id:'setlist', icon:'≡', label:'Set List' },
]

const s = {
  app: { display:'flex', flexDirection:'column', height:'100dvh', background:'#0f0f0f', overflow:'hidden' },
  header: { padding:'16px 16px 0', background:'#0f0f0f', flexShrink:0 },
  headerTitle: { fontSize:22, fontWeight:700, letterSpacing:'-0.02em', color:'#fff', marginBottom:12 },
  headerSub: { color:'#555', fontWeight:400, fontSize:18 },
  scroll: { flex:1, overflowY:'auto', WebkitOverflowScrolling:'touch', paddingBottom:90, overflowX:'hidden' },
  bottomNav: {
    position:'fixed', bottom:0, left:0, right:0,
    background:'rgba(15,15,15,0.95)',
    backdropFilter:'blur(20px)',
    WebkitBackdropFilter:'blur(20px)',
    borderTop:'1px solid #222',
    display:'flex', paddingBottom:'env(safe-area-inset-bottom)',
    zIndex:100,
  },
  navBtn: {
    flex:1, display:'flex', flexDirection:'column', alignItems:'center',
    gap:4, padding:'10px 0', background:'none', border:'none', cursor:'pointer',
    color:'#555', fontSize:10, fontWeight:500, letterSpacing:'0.04em',
    textTransform:'uppercase', transition:'color 0.15s',
  },
  navIcon: { fontSize:22, lineHeight:1 },
  filterRow: { display:'flex', gap:6, padding:'12px 16px 0', overflowX:'auto', scrollbarWidth:'none', flexShrink:0 },
  filterPill: (active) => ({
    padding:'6px 14px', borderRadius:20, border:'none', cursor:'pointer',
    fontSize:13, fontWeight:500, whiteSpace:'nowrap', transition:'all 0.15s',
    background: active ? '#fff' : '#1a1a1a',
    color: active ? '#000' : '#888',
  }),
  searchRow: { padding:'10px 12px', flexShrink:0, width:'100%' },
  searchInput: {
    width:'93.8%', padding:'10px 12px', background:'#1a1a1a',
    border:'1px solid #2a2a2a', borderRadius:12, color:'#fff',
    fontSize:15, outline:'none', boxSizing:'border-box', display:'block',
  },
  card: (expanded, event) => ({
    margin:'0 8px 8px',
    background:'#161616',
    border:'1px solid #222',
    borderLeft:`3px solid ${EVENT_ACCENT[event] || '#333'}`,
    borderRadius:12,
    overflow:'hidden',
    transition:'border-color 0.15s',
  }),
  cardHeader: { padding:'13px 14px', display:'flex', alignItems:'center', gap:10, cursor:'pointer' },
  cardLeft: { flex:1, minWidth:0 },
  cardName: { fontSize:15, fontWeight:600, color:'#fff', marginBottom:2, lineHeight:1.2 },
  cardArtist: { fontSize:12, color:'#666' },
  cardRight: { display:'flex', alignItems:'center', gap:8, flexShrink:0 },
  keyBadge: {
    background:'#1a2a3a', color:'#60a5fa', border:'1px solid #1e3a5a',
    borderRadius:8, fontSize:12, fontWeight:600, padding:'3px 8px',
  },
  starBtn: { background:'none', border:'none', cursor:'pointer', fontSize:18, padding:0, lineHeight:1 },
  chevron: (open) => ({
    color:'#444', fontSize:12, transition:'transform 0.2s',
    transform: open ? 'rotate(180deg)' : 'rotate(0deg)', display:'block',
  }),
  evPill: (ev) => {
    const c = EVENT_COLORS[ev] || EVENT_COLORS.all
    return { background:c.bg, color:c.text, border:`1px solid ${c.border}`, borderRadius:6, fontSize:10, fontWeight:600, padding:'2px 7px', letterSpacing:'0.03em', textTransform:'uppercase' }
  },
  detail: { borderTop:'1px solid #222', padding:'14px', boxSizing:'border-box', width:'100%', overflow:'hidden' },
  detailGrid: { display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:12, width:'100%', boxSizing:'border-box' },
  fieldLabel: { fontSize:11, color:'#555', display:'block', marginBottom:5, fontWeight:500, textTransform:'uppercase', letterSpacing:'0.06em' },
  fieldSelect: { width:'100%', padding:'9px 10px', background:'#1e1e1e', border:'1px solid #2a2a2a', borderRadius:8, color:'#fff', fontSize:13, boxSizing:'border-box' },
  fieldInput: { width:'100%', padding:'9px 10px', background:'#1e1e1e', border:'1px solid #2a2a2a', borderRadius:8, color:'#fff', fontSize:13, boxSizing:'border-box' },
  fieldTextarea: { width:'100%', padding:'9px 10px', background:'#1e1e1e', border:'1px solid #2a2a2a', borderRadius:8, color:'#fff', fontSize:13, resize:'vertical', fontFamily:'inherit', boxSizing:'border-box' },
  chordBox: { width:'100%', padding:'10px 12px', background:'#111', border:'1px solid #2a2a2a', borderRadius:8, color:'#60a5fa', fontSize:14, fontFamily:'monospace', resize:'vertical', minHeight:70, boxSizing:'border-box' },
  deleteBtn: { padding:'8px 16px', background:'none', border:'1px solid #2a2a2a', borderRadius:8, color:'#e05555', fontSize:13, cursor:'pointer' },
  kfCard: { margin:'12px', background:'#161616', border:'1px solid #222', borderRadius:14, padding:16, marginBottom:10 },
  kfLabel: { fontSize:11, color:'#555', fontWeight:500, textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:12 },
  kfRow: { display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 },
  kfRowLabel: { fontSize:14, color:'#ccc' },
  kfSelect: { padding:'7px 10px', background:'#1e1e1e', border:'1px solid #2a2a2a', borderRadius:8, color:'#fff', fontSize:13, maxWidth:180 },
  kfResult: { margin:'0 12px', background:'#161616', border:'1px solid #222', borderRadius:14, padding:28, textAlign:'center' },
  kfResultKey: { fontSize:72, fontWeight:700, color:'#fff', lineHeight:1, letterSpacing:'-0.04em' },
  kfResultSub: { fontSize:13, color:'#555', marginTop:6 },
  kfAlts: { display:'flex', gap:8, justifyContent:'center', marginTop:14, flexWrap:'wrap' },
  kfAlt: { padding:'5px 14px', border:'1px solid #2a2a2a', borderRadius:20, color:'#888', fontSize:13 },
  runBtn: { width:'calc(100% - 24px)', margin:'10px 12px', padding:15, background:'#fff', border:'none', borderRadius:12, color:'#000', fontSize:15, fontWeight:600, cursor:'pointer' },
  patchSection: { margin:'12px 12px 0' },
  patchSectionLabel: { fontSize:11, color:'#555', fontWeight:500, textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:10 },
  patchGrid: { display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:20 },
  patchCard: { background:'#161616', border:'1px solid #222', borderRadius:12, padding:12 },
  patchName: { fontSize:13, fontWeight:600, color:'#fff', marginBottom:3 },
  patchSrc: { fontSize:11, color:'#555', marginBottom:6 },
  patchWhen: { fontSize:11, color:'#888', lineHeight:1.5 },
  empty: { textAlign:'center', padding:'60px 20px', color:'#444', fontSize:15 },
}

function GigMode({ songs, onExit }) {
  const [idx, setIdx] = useState(0)
  const [offset, setOffset] = useState(0)
  const touchStartX = useRef(null)

  useEffect(() => {
    let wl = null
    async function lock() {
      try { wl = await navigator.wakeLock?.request('screen') } catch {}
    }
    lock()
    return () => { wl?.release() }
  }, [])

  useEffect(() => { setOffset(0) }, [idx])

  if (!songs.length) return (
    <div style={{ position:'fixed', inset:0, background:'#000', zIndex:200, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', color:'#444' }}>
      <div style={{ fontSize:15, marginBottom:24 }}>No songs to show</div>
      <button onClick={onExit} style={{ background:'none', border:'1px solid #333', borderRadius:10, color:'#888', fontSize:15, padding:'10px 24px', cursor:'pointer' }}>Exit</button>
    </div>
  )

  const song = songs[Math.min(idx, songs.length - 1)]
  const displayKey = transposeKey(song.key, offset)

  function prev() { setIdx(i => Math.max(0, i - 1)) }
  function next() { setIdx(i => Math.min(songs.length - 1, i + 1)) }

  function onTouchStart(e) { touchStartX.current = e.touches[0].clientX }
  function onTouchEnd(e) {
    if (touchStartX.current === null) return
    const dx = e.changedTouches[0].clientX - touchStartX.current
    if (dx > 50) prev()
    else if (dx < -50) next()
    touchStartX.current = null
  }

  return (
    <div
      style={{ position:'fixed', inset:0, background:'#000', zIndex:200, display:'flex', flexDirection:'column', color:'#fff', userSelect:'none' }}
      onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}
    >
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'16px 20px', flexShrink:0 }}>
        <button onClick={onExit} style={{ background:'none', border:'none', color:'#555', fontSize:24, cursor:'pointer', padding:0, lineHeight:1 }}>✕</button>
        <span style={{ color:'#444', fontSize:13 }}>{idx + 1} / {songs.length}</span>
      </div>

      <div style={{ flex:1, overflowY:'auto', padding:'12px 24px 24px', display:'flex', flexDirection:'column' }}>
        <div style={{ fontSize:48, fontWeight:700, lineHeight:1.1, letterSpacing:'-0.02em', marginBottom:10 }}>{song.name}</div>
        {song.artist && <div style={{ fontSize:16, color:'#666', marginBottom:24 }}>{song.artist}</div>}

        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10 }}>
          <button
            onClick={() => setOffset(o => o - 1)}
            style={{ width:38, height:38, background:'#1a1a1a', border:'1px solid #333', borderRadius:8, color:'#fff', fontSize:22, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', lineHeight:1 }}
          >−</button>
          <span style={{ background:'#1a2a3a', color:'#60a5fa', border:'1px solid #1e3a5a', borderRadius:8, fontSize:18, fontWeight:700, padding:'6px 14px', minWidth:52, textAlign:'center' }}>
            {displayKey || '—'}
          </span>
          <button
            onClick={() => setOffset(o => o + 1)}
            style={{ width:38, height:38, background:'#1a1a1a', border:'1px solid #333', borderRadius:8, color:'#fff', fontSize:22, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', lineHeight:1 }}
          >+</button>
          {offset !== 0 && <span style={{ color:'#555', fontSize:13 }}>{offset > 0 ? `+${offset}` : offset} st</span>}
        </div>

        {song.patch && <div style={{ color:'#555', fontSize:14, marginBottom:20 }}>{song.patch}</div>}

        {song.chords && (
          <pre style={{ fontFamily:'monospace', fontSize:15, color:'#ddd', lineHeight:1.9, whiteSpace:'pre-wrap', margin:0 }}>{song.chords}</pre>
        )}

        {song.notes && (
          <div style={{ marginTop:20, color:'#555', fontSize:14, lineHeight:1.6, borderTop:'1px solid #111', paddingTop:16 }}>{song.notes}</div>
        )}
      </div>

      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'14px 20px', borderTop:'1px solid #111', flexShrink:0 }}>
        <button onClick={prev} disabled={idx === 0} style={{ background:'none', border:'1px solid #222', borderRadius:10, color: idx === 0 ? '#2a2a2a' : '#fff', fontSize:26, padding:'8px 22px', cursor: idx === 0 ? 'default' : 'pointer', lineHeight:1 }}>‹</button>
        <div style={{ color:'#333', fontSize:13 }}>{song.tempo || ''}</div>
        <button onClick={next} disabled={idx === songs.length - 1} style={{ background:'none', border:'1px solid #222', borderRadius:10, color: idx === songs.length - 1 ? '#2a2a2a' : '#fff', fontSize:26, padding:'8px 22px', cursor: idx === songs.length - 1 ? 'default' : 'pointer', lineHeight:1 }}>›</button>
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
    const { data } = await supabase.from('setlists').select('*').order('created_at', { ascending: false })
    setSetlists(data || [])
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

  // List view
  if (!active) return (
    <div style={{ padding:'12px', paddingBottom:90 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
        <div style={{ fontSize:18, fontWeight:600, color:'#fff' }}>Set Lists</div>
        <button onClick={() => setCreating(true)}
          style={{ background:'#1a1a1a', border:'1px solid #333', borderRadius:8, color:'#fff', fontSize:13, padding:'7px 14px', cursor:'pointer' }}>+ New</button>
      </div>

      {creating && (
        <div style={{ background:'#161616', border:'1px solid #2a2a2a', borderRadius:12, padding:14, marginBottom:12 }}>
          <input autoFocus placeholder="Set list name..." value={newName}
            onChange={e => setNewName(e.target.value)} onKeyDown={e => e.key === 'Enter' && createSetlist()}
            style={{ width:'100%', padding:'9px 10px', background:'#1e1e1e', border:'1px solid #2a2a2a', borderRadius:8, color:'#fff', fontSize:14, boxSizing:'border-box', marginBottom:10, outline:'none' }} />
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:10 }}>
            <select value={newEvent} onChange={e => setNewEvent(e.target.value)}
              style={{ padding:'9px 10px', background:'#1e1e1e', border:'1px solid #2a2a2a', borderRadius:8, color:'#fff', fontSize:13, boxSizing:'border-box' }}>
              <option value="kumzitz">Kumzitz</option>
              <option value="sheva">Sheva Brachos</option>
              <option value="wedding">Wedding</option>
              <option value="all">All events</option>
            </select>
            <input type="date" value={newDate} onChange={e => setNewDate(e.target.value)}
              style={{ padding:'9px 10px', background:'#1e1e1e', border:'1px solid #2a2a2a', borderRadius:8, color:'#fff', fontSize:13, boxSizing:'border-box', colorScheme:'dark' }} />
          </div>
          <div style={{ display:'flex', gap:8 }}>
            <button onClick={createSetlist}
              style={{ flex:1, padding:'9px 0', background:'#fff', border:'none', borderRadius:8, color:'#000', fontSize:13, fontWeight:600, cursor:'pointer' }}>Create</button>
            <button onClick={() => { setCreating(false); setNewName('') }}
              style={{ padding:'9px 14px', background:'none', border:'1px solid #2a2a2a', borderRadius:8, color:'#888', fontSize:13, cursor:'pointer' }}>Cancel</button>
          </div>
        </div>
      )}

      {setlists.length === 0 && !creating && (
        <div style={{ textAlign:'center', padding:'60px 20px', color:'#444', fontSize:15 }}>No set lists yet.</div>
      )}
      {setlists.map(sl => (
        <div key={sl.id} onClick={() => openSetlist(sl)}
          style={{ background:'#161616', border:'1px solid #222', borderLeft:`3px solid ${EVENT_ACCENT[sl.event_type]||'#333'}`, borderRadius:12, padding:'13px 14px', marginBottom:8, cursor:'pointer' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <div style={{ minWidth:0, flex:1 }}>
              <div style={{ fontSize:15, fontWeight:600, color:'#fff', marginBottom:4 }}>{sl.name}</div>
              <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                <span style={s.evPill(sl.event_type)}>
                  {sl.event_type === 'sheva' ? 'SB' : sl.event_type === 'kumzitz' ? 'KZ' : sl.event_type === 'wedding' ? 'WD' : 'ALL'}
                </span>
                {sl.event_date && <span style={{ color:'#555', fontSize:12 }}>{sl.event_date}</span>}
              </div>
            </div>
            <button onClick={e => deleteSetlist(sl.id, e)}
              style={{ background:'none', border:'none', color:'#444', fontSize:22, cursor:'pointer', padding:'0 4px', lineHeight:1, flexShrink:0 }}>×</button>
          </div>
        </div>
      ))}
    </div>
  )

  // Detail view — fixed overlay so header stays pinned and content scrolls
  return (
    <div style={{ position:'fixed', inset:0, background:'#0f0f0f', zIndex:150, display:'flex', flexDirection:'column' }}>
      <div style={{ padding:'12px 14px 10px', borderBottom:'1px solid #1a1a1a', flexShrink:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:6 }}>
          <button onClick={() => setActive(null)}
            style={{ background:'none', border:'none', color:'#555', fontSize:22, cursor:'pointer', padding:0, lineHeight:1 }}>‹</button>
          <div style={{ flex:1, fontSize:16, fontWeight:600, color:'#fff', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{active.name}</div>
          <button onClick={() => onPlay(slotSongs)} disabled={slotSongs.length === 0}
            style={{ background: slotSongs.length ? '#fff' : '#1a1a1a', border:'none', borderRadius:8, color: slotSongs.length ? '#000' : '#444', fontSize:13, fontWeight:600, padding:'7px 14px', cursor: slotSongs.length ? 'pointer' : 'default', flexShrink:0 }}>
            ▶ Play
          </button>
        </div>
        <div style={{ display:'flex', gap:6, alignItems:'center', paddingLeft:32 }}>
          <span style={s.evPill(active.event_type)}>
            {active.event_type === 'sheva' ? 'SB' : active.event_type === 'kumzitz' ? 'KZ' : active.event_type === 'wedding' ? 'WD' : 'ALL'}
          </span>
          {active.event_date && <span style={{ color:'#555', fontSize:12 }}>{active.event_date}</span>}
          <span style={{ color:'#444', fontSize:12 }}>{slots.length} songs</span>
        </div>
      </div>

      <div style={{ flex:1, overflowY:'auto', WebkitOverflowScrolling:'touch' }}>
        <div style={{ padding:'12px', paddingBottom:32 }}>
          <input placeholder="Search songs to add..." value={songSearch}
            onChange={e => setSongSearch(e.target.value)}
            style={{ width:'100%', padding:'9px 12px', background:'#1a1a1a', border:'1px solid #2a2a2a', borderRadius:10, color:'#fff', fontSize:14, boxSizing:'border-box', outline:'none' }} />

          {filteredSongs.length > 0 && (
            <div style={{ background:'#161616', border:'1px solid #222', borderRadius:10, overflow:'hidden', marginTop:4, marginBottom:12 }}>
              {filteredSongs.map((song, i) => (
                <div key={song.id} onClick={() => addSong(song)}
                  style={{ padding:'11px 14px', display:'flex', justifyContent:'space-between', alignItems:'center', borderBottom: i < filteredSongs.length - 1 ? '1px solid #1a1a1a' : 'none', cursor:'pointer' }}>
                  <div style={{ minWidth:0, flex:1 }}>
                    <div style={{ fontSize:14, color:'#fff', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{song.name}</div>
                    {song.artist && <div style={{ fontSize:12, color:'#555' }}>{song.artist}</div>}
                  </div>
                  <span style={{ color:'#60a5fa', fontSize:20, lineHeight:1, flexShrink:0, marginLeft:8 }}>+</span>
                </div>
              ))}
            </div>
          )}

          {loadingSlots && <div style={{ color:'#444', textAlign:'center', padding:20 }}>Loading...</div>}
          {!loadingSlots && slots.length === 0 && (
            <div style={{ color:'#444', textAlign:'center', padding:'40px 0', fontSize:14 }}>Search above to add songs.</div>
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
                    background: isOver ? '#1a2e1a' : '#161616',
                    border:`1px solid ${isOver ? '#2d4d2d' : '#222'}`,
                    borderRadius:10,
                    opacity: isDragging ? 0.35 : 1,
                    transition:'background 0.1s, border-color 0.1s, opacity 0.1s',
                  }}>
                  <span style={{ color:'#555', fontSize:12, fontVariantNumeric:'tabular-nums', minWidth:18, textAlign:'right' }}>{i + 1}</span>
                  <span onTouchStart={e => onHandleTouchStart(e, i)}
                    style={{ color:'#383838', fontSize:16, cursor:'grab', touchAction:'none', userSelect:'none', paddingRight:2 }}>⠿</span>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:14, color:'#fff', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{song?.name}</div>
                    {song?.artist && <div style={{ fontSize:12, color:'#555' }}>{song.artist}</div>}
                  </div>
                  {song?.key && <span style={{ background:'#1a2a3a', color:'#60a5fa', border:'1px solid #1e3a5a', borderRadius:6, fontSize:11, fontWeight:600, padding:'2px 6px', flexShrink:0 }}>{song.key}</span>}
                  <button onClick={() => removeSong(slot.id)}
                    style={{ background:'none', border:'none', color:'#3a3a3a', fontSize:22, cursor:'pointer', padding:'0 2px', lineHeight:1, flexShrink:0 }}>×</button>
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
  return { width:'100%', padding:'9px 10px', background:'#1e1e1e', border:'1px solid #2a2a2a', borderRadius:8, color:'#fff', fontSize:13, boxSizing:'border-box' }
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
  const [saving, setSaving] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)

  async function searchWithClaude() {
    if (!name.trim()) return
    setAiLoading(true)
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 1000,
          messages: [{
            role: 'user',
            content: `Give me the chord chart for "${name}"${artist ? ` by ${artist}` : ''} in the key of ${key}.
Format it exactly like this — nothing else, no explanation:

TEMPO: [tempo feel]
NOTES: [one line performance tip]
CHORDS:
[Section]: [chords using | as bar separator]

Sections should be: Intro, Verse, Chorus, Bridge (only include sections that exist).
Keep chords simple (Dm, G, Am, F etc). Jewish music style.`
          }]
        })
      })
      const data = await res.json()
      const text = data.content?.[0]?.text || ''
      const tempoMatch = text.match(/TEMPO:\s*(.+)/i)
      const notesMatch = text.match(/NOTES:\s*(.+)/i)
      const chordsMatch = text.match(/CHORDS:\n([\s\S]+)/i)
      if (tempoMatch) setTempo(tempoMatch[1].trim())
      if (notesMatch) setNotes(notesMatch[1].trim())
      if (chordsMatch) setChords(chordsMatch[1].trim())
    } catch(e) {
      console.error(e)
    }
    setAiLoading(false)
  }

  async function save() {
    if (!name.trim()) return
    setSaving(true)
    const { error } = await supabase.from('songs').insert({
      name: name.trim(), artist: artist.trim(), key, event_type: event,
      patch, chords, notes, tempo
    })
    if (!error) {
      setName(''); setArtist(''); setKey('D'); setChords('')
      setNotes(''); setTempo(''); setEvent('kumzitz')
      onSaved()
    }
    setSaving(false)
  }

  const googleUrl = `https://www.google.com/search?q=${encodeURIComponent(name + ' ' + artist + ' chords')}`

  return (
    <div style={{ padding:'16px', paddingBottom:90 }}>
      <div style={{ fontSize:18, fontWeight:600, color:'#fff', marginBottom:16 }}>Add Song</div>

      <div style={{ background:'#161616', border:'1px solid #222', borderRadius:14, padding:14, marginBottom:12 }}>
        <div style={{ fontSize:11, color:'#555', fontWeight:500, textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:12 }}>Song Info</div>
        {[
          ['Song name', <input key="name" value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. Od Yishama" style={inp2()} autoFocus />],
          ['Artist', <input key="artist" value={artist} onChange={e=>setArtist(e.target.value)} placeholder="e.g. MBD, Traditional..." style={inp2()} />],
        ].map(([label, input]) => (
          <div key={label} style={{ marginBottom:10 }}>
            <label style={{ fontSize:11, color:'#555', display:'block', marginBottom:4, textTransform:'uppercase', letterSpacing:'0.06em' }}>{label}</label>
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
        </div>
      </div>

      <div style={{ background:'#161616', border:'1px solid #222', borderRadius:14, padding:14, marginBottom:12 }}>
        <div style={{ fontSize:11, color:'#555', fontWeight:500, textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:12 }}>Find Chords</div>
        <div style={{ display:'flex', gap:8, marginBottom:12 }}>
          <button onClick={searchWithClaude} disabled={aiLoading || !name.trim()} style={{
            flex:1, padding:'11px 0', background: aiLoading ? '#1e1e1e' : '#1a2a3a',
            border:'1px solid #1e3a5a', borderRadius:10, color: aiLoading ? '#555' : '#60a5fa',
            fontSize:13, fontWeight:600, cursor: name.trim() ? 'pointer' : 'not-allowed'
          }}>
            {aiLoading ? 'Searching...' : '✦ Ask Claude'}
          </button>
          <a href={googleUrl} target="_blank" rel="noopener noreferrer" style={{
            flex:1, padding:'11px 0', background:'#1e1e1e',
            border:'1px solid #2a2a2a', borderRadius:10, color:'#aaa',
            fontSize:13, fontWeight:600, textDecoration:'none', textAlign:'center', display:'block'
          }}>⌕ Google</a>
        </div>
        <label style={{ fontSize:11, color:'#555', display:'block', marginBottom:6, textTransform:'uppercase', letterSpacing:'0.06em' }}>Chords</label>
        <textarea
          value={chords} onChange={e=>setChords(e.target.value)}
          placeholder={'Intro: Dm | Gm | A7 | Dm\nVerse: Dm | Gm | Dm | A7\nChorus: F | Bb | C | Dm'}
          rows={6}
          style={{ width:'100%', padding:'10px 12px', background:'#111', border:'1px solid #2a2a2a', borderRadius:10, color:'#60a5fa', fontSize:13, fontFamily:'monospace', resize:'vertical', boxSizing:'border-box' }}
        />
        <label style={{ fontSize:11, color:'#555', display:'block', marginBottom:6, marginTop:10, textTransform:'uppercase', letterSpacing:'0.06em' }}>Performance notes</label>
        <textarea
          value={notes} onChange={e=>setNotes(e.target.value)}
          placeholder="Tips, energy arc, watch-outs..."
          rows={2}
          style={{ width:'100%', padding:'10px 12px', background:'#1e1e1e', border:'1px solid #2a2a2a', borderRadius:10, color:'#ccc', fontSize:13, resize:'vertical', boxSizing:'border-box' }}
        />
      </div>

      <button onClick={save} disabled={saving || !name.trim()} style={{
        width:'100%', padding:15, background: name.trim() ? '#fff' : '#1e1e1e',
        border:'none', borderRadius:12, color: name.trim() ? '#000' : '#555',
        fontSize:15, fontWeight:600, cursor: name.trim() ? 'pointer' : 'not-allowed'
      }}>
        {saving ? 'Saving...' : 'Save song'}
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
  const [expandedId, setExpandedId] = useState(null)
  const [gigSongs, setGigSongs] = useState(null)
  const [gigReturnTab, setGigReturnTab] = useState('songs')

  const [kfCrowd, setKfCrowd] = useState('mixed')
  const [kfComfort, setKfComfort] = useState('medium')
  const [kfHasSinger, setKfHasSinger] = useState(false)
  const [kfVoice, setKfVoice] = useState('baritone')
  const [kfTopNote, setKfTopNote] = useState('A4')
  const [kfSongRange, setKfSongRange] = useState('medium')
  const [kfResult, setKfResult] = useState(null)

  useEffect(() => { fetchSongs() }, [])

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
  }

  const filtered = songs.filter(s => {
    const matchEvent = eventFilter === 'all' || s.event_type === eventFilter || s.event_type === 'all'
    const matchQ = !search || s.name.toLowerCase().includes(search.toLowerCase()) || (s.artist||'').toLowerCase().includes(search.toLowerCase())
    return matchEvent && matchQ
  })

  return (
    <div style={s.app}>
      <div style={s.header}>
        <div style={s.headerTitle}>
          Niggun <span style={s.headerSub}>/ chord book</span>
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
          </div>
          <div style={s.searchRow}>
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search songs or artist..." style={s.searchInput} />
          </div>
          {loading
            ? <div style={s.empty}>Loading...</div>
            : filtered.length === 0
            ? <div style={s.empty}>No songs yet.</div>
            : filtered.map(song => (
              <div key={song.id} style={s.card(expandedId === song.id, song.event_type)}>
                <div style={s.cardHeader} onClick={() => setExpandedId(expandedId === song.id ? null : song.id)}>
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
                    <span style={s.chevron(expandedId === song.id)}>▼</span>
                  </div>
                </div>
                {expandedId === song.id && (
                  <div style={s.detail}>
                    <div style={s.detailGrid}>
                      <div>
                        <label style={s.fieldLabel}>Key</label>
                        <select value={song.key || 'D'} onChange={e => updateSong(song.id,'key',e.target.value)} style={s.fieldSelect}>
                          {KEYS.map(k => <option key={k}>{k}</option>)}
                        </select>
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
                      <div style={{gridColumn:'1/-1'}}>
                        <label style={s.fieldLabel}>Tempo</label>
                        <input defaultValue={song.tempo||''} onBlur={e => updateSong(song.id,'tempo',e.target.value)} placeholder="e.g. Slow build, Upbeat..." style={s.fieldInput} />
                      </div>
                    </div>
                    <div style={{marginBottom:10}}>
                      <label style={s.fieldLabel}>Chords</label>
                      <textarea defaultValue={song.chords||''} onBlur={e => updateSong(song.id,'chords',e.target.value)} rows={3} style={s.chordBox} />
                    </div>
                    <div style={{marginBottom:14}}>
                      <label style={s.fieldLabel}>Notes</label>
                      <textarea defaultValue={song.notes||''} onBlur={e => updateSong(song.id,'notes',e.target.value)} rows={2} style={s.fieldTextarea} />
                    </div>
                    <button onClick={() => deleteSong(song.id)} style={s.deleteBtn}>Remove song</button>
                  </div>
                )}
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
            </div>
          )}
          <button onClick={runKeyFinder} style={s.runBtn}>Find best key</button>
          {kfResult && (
            <div style={s.kfResult}>
              <div style={s.kfResultKey}>{kfResult.key}</div>
              <div style={s.kfResultSub}>Suggested key</div>
              <div style={s.kfAlts}>
                {kfResult.alts.map(k => <span key={k} style={s.kfAlt}>{k}</span>)}
              </div>
            </div>
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
          <button key={t.id} style={{ ...s.navBtn, color: tab === t.id ? '#fff' : '#555' }}
            onClick={() => { if (t.id === 'gig') { setGigSongs(null); setGigReturnTab('songs') } setTab(t.id) }}>
            <span style={s.navIcon}>{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'gig' && <GigMode songs={gigSongs || songs} onExit={() => { setGigSongs(null); setTab(gigReturnTab) }} />}
    </div>
  )
}