import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { supabase } from '../../lib/supabase' // <- adjust
import Avatar from '../Avatar'                  // <- adjust if Avatar lives elsewhere
import ShushhhMascot from './ShushhhMascot'
import { useShushhhRoom, makeRoomTopic, sendInvite, shushhhBusy } from './useShushhhRoom'

const IconX = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" /></svg>
)

export default function ShushhhExperience({ me, incoming = null, onClose }) {
  const reduce = useReducedMotion()
  const [stage, setStage] = useState('intro') // intro | pick | room | leaving
  const [peer, setPeer] = useState(null)
  const [topic, setTopic] = useState(incoming?.topic || null)
  const [roomActive, setRoomActive] = useState(false)
  const [declining, setDeclining] = useState(false)
  const [confirmLeave, setConfirmLeave] = useState(false)
  const [introDone, setIntroDone] = useState(false)
  const [inviteFailed, setInviteFailed] = useState(false)
  const [waitedLong, setWaitedLong] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [draft, setDraft] = useState('')

  const stageRef = useRef(stage); stageRef.current = stage
  const closingRef = useRef(false)
  const doneRef = useRef(false)
  const invitedRef = useRef(false)
  const listRef = useRef(null)

  const room = useShushhhRoom({ topic, me, peerId: peer?.id, active: roomActive })

  const done = useCallback(() => {
    if (doneRef.current) return
    doneRef.current = true
    onClose?.()
  }, [onClose])

  // exit: remove the history entry we added, then close
  const finalize = useCallback(() => {
    if (closingRef.current) return
    closingRef.current = true
    window.history.back()
    setTimeout(done, 400) // fallback if popstate never fires
  }, [done])

  // busy flag + history + keyboard
  useEffect(() => {
    shushhhBusy.current = true
    window.history.pushState({ shushhh: true }, '')
    const onPop = (e) => {
      e.stopImmediatePropagation()
      if (closingRef.current) { done(); return }
      if (stageRef.current === 'room') {
        window.history.pushState({ shushhh: true }, '')
        setConfirmLeave(true)
      } else if (stageRef.current !== 'leaving') {
        closingRef.current = true
        done()
      } else {
        window.history.pushState({ shushhh: true }, '')
      }
    }
    const onKey = (e) => {
      if (e.key !== 'Escape') return
      if (stageRef.current === 'room') setConfirmLeave((v) => !v)
    }
    window.addEventListener('popstate', onPop, true)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('popstate', onPop, true)
      window.removeEventListener('keydown', onKey)
      shushhhBusy.current = false
    }
  }, [done])
  // safety nets: never let an animation callback strand the screen
  useEffect(() => {
    if (stage !== 'intro') return undefined
    const t = setTimeout(() => setIntroDone(true), 2800)
    return () => clearTimeout(t)
  }, [stage])

  useEffect(() => {
    if (stage !== 'leaving') return undefined
    const t = setTimeout(() => finalize(), 2000)
    return () => clearTimeout(t)
  }, [stage, finalize])
  // incoming: look up who invited us
  useEffect(() => {
    if (!incoming) return
    supabase.from('profiles').select('id, username, avatar_url').eq('id', incoming.fromId).single()
      .then(({ data }) => setPeer(data || { id: incoming.fromId, username: 'Someone', avatar_url: null }))
  }, [incoming])

  // host: user search
  useEffect(() => {
    if (stage !== 'pick') return undefined
    const t = setTimeout(async () => {
      let q = supabase.from('profiles').select('id, username, avatar_url').neq('id', me).limit(20)
      if (query.trim()) q = q.ilike('username', `%${query.trim()}%`)
      const { data } = await q
      setResults(data || [])
    }, 250)
    return () => clearTimeout(t)
  }, [stage, query, me])

  // host: send invite once our room channel is ready
  useEffect(() => {
    if (incoming || stage !== 'room' || room.conn !== 'ready' || invitedRef.current || !peer) return
    invitedRef.current = true
    sendInvite({ to: peer.id, topic, from: me }).then((ok) => { if (!ok) setInviteFailed(true) })
  }, [room.conn, stage, incoming, peer, topic, me])

  useEffect(() => {
    if (stage !== 'room' || incoming || room.peerHere) { setWaitedLong(false); return undefined }
    const t = setTimeout(() => setWaitedLong(true), 45000)
    return () => clearTimeout(t)
  }, [stage, incoming, room.peerHere])

  // decline: join room briefly so the host gets a "left" signal, then close
  useEffect(() => {
    if (!declining) return undefined
    const t = setTimeout(() => finalize(), 3000)
    if (room.conn === 'ready') { setRoomActive(false); finalize() }
    return () => clearTimeout(t)
  }, [declining, room.conn, finalize])

  useEffect(() => { listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: reduce ? 'auto' : 'smooth' }) }, [room.messages.length, reduce])

  const enter = () => {
    if (incoming) { setRoomActive(true); setStage('room') } else setStage('pick')
  }
  const decline = () => { setRoomActive(true); setDeclining(true) }
  const startRoom = (user) => {
    setPeer(user)
    setTopic(makeRoomTopic(me, user.id))
    setRoomActive(true)
    setStage('room')
  }
  const leave = () => {
    setConfirmLeave(false)
    setRoomActive(false) // tears down channel + wipes messages immediately
    setStage('leaving')
  }
  const sendDraft = () => { const t = draft; setDraft(''); room.send(t) }

  const name = peer?.username || 'them'
  const showText = introDone || reduce

  return createPortal(
    <div style={shell} role="dialog" aria-modal="true" aria-label="Shushhh">
      {/* ---------- INTRO ---------- */}
      {stage === 'intro' && (
        <div style={center}>
          {!incoming && <button style={closeFloat} onClick={finalize} aria-label="Close"><IconX /></button>}
          <ShushhhMascot size={168} mood={introDone ? 'idle' : 'entrance'} onDone={() => setIntroDone(true)} />
          <AnimatePresence>
            {showText && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} style={{ textAlign: 'center' }}>
                <h1 style={h1}>Shushhh...</h1>
                <p style={sub}>This conversation won't stay here.</p>
                {incoming && (
                  <div style={noticeBox}>
                    <div style={{ fontWeight: 700 }}>You're entering a Shushhh conversation.</div>
                    <div style={{ opacity: 0.75, marginTop: 4 }}>{name} invited you. Messages here aren't added to your normal Mattchat chat history.</div>
                  </div>
                )}
                <button style={primaryBtn} onClick={enter}>Enter Shushhh</button>
                {incoming && <button style={ghostBtn} onClick={decline} disabled={declining}>{declining ? 'Declining…' : 'Not now'}</button>}
                <div style={fine}>Shushhh conversations aren't saved to your Mattchat chat history.</div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* ---------- PICK ---------- */}
      {stage === 'pick' && (
        <>
          <Header onLeft={finalize} title="Shushhh" subtitle="Temporary conversation" />
          <div style={{ padding: '14px 16px', maxWidth: 560, width: '100%', margin: '0 auto', boxSizing: 'border-box' }}>
            <div style={sub}>Who is this for?</div>
            <input
              autoFocus value={query} onChange={(e) => setQuery(e.target.value)}
              placeholder="Search people…" autoComplete="off" autoCorrect="off" spellCheck={false}
              style={searchInput} aria-label="Search people"
            />
            <div style={{ marginTop: 10 }}>
              {results.map((u) => (
                <button key={u.id} style={personRow} onClick={() => startRoom(u)}>
                  <Avatar name={u.username} size={38} photoUrl={u.avatar_url} />
                  <span style={{ fontWeight: 650 }}>{u.username}</span>
                </button>
              ))}
              {results.length === 0 && <div style={{ ...fine, padding: 24 }}>No one found</div>}
            </div>
          </div>
        </>
      )}

      {/* ---------- ROOM ---------- */}
      {stage === 'room' && (
        <>
          <Header onLeft={() => setConfirmLeave(true)} title="Shushhh" subtitle="Temporary conversation" />
          <div style={privacyPill}>
            <span>This chat disappears when you leave.</span>
            <span style={{ opacity: 0.6 }}>Shushhh conversations aren't saved to your Mattchat chat history.</span>
          </div>

          <div style={statusLine}>
            {room.conn === 'error' ? "Couldn't connect. Leave and try again."
              : room.peerLeft ? `${name} left Shushhh. This room is closed.`
              : inviteFailed ? `Couldn't reach ${name}. They may be offline.`
              : room.peerHere ? `${name} is here`
              : waitedLong ? `No response from ${name} yet. They may be offline.`
              : `Waiting for ${name}…`}
          </div>

          <div ref={listRef} style={msgList}>
            {room.messages.length === 0 ? (
              <div style={emptyWrap}>
                <ShushhhMascot size={84} mood="curious" />
                <div style={{ fontWeight: 800, marginTop: 6 }}>Psst...</div>
                <div style={{ ...sub, margin: '4px 0' }}>Nothing said here goes into your normal chat history.</div>
                <div style={sub}>Go ahead. I'm listening. 🤫</div>
              </div>
            ) : room.messages.map((m) => {
              const mine = m.from === me
              return (
                <motion.div key={m.id} initial={reduce ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                  style={{ alignSelf: mine ? 'flex-end' : 'flex-start', ...(mine ? bubbleMine : bubbleTheirs) }}>
                  {m.text}
                  {m.state === 'failed' && <div style={{ fontSize: 10.5, color: '#fca5a5', marginTop: 2 }}>Not delivered</div>}
                </motion.div>
              )
            })}
          </div>

          <div style={composer}>
            <input
              value={draft} onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendDraft() } }}
              placeholder={room.peerLeft ? 'Room closed' : 'Whisper something…'}
              disabled={room.peerLeft || room.conn !== 'ready'}
              maxLength={2000} name="shushhh-message" autoComplete="off" autoCorrect="off" autoCapitalize="sentences"
              spellCheck={false} enterKeyHint="send" style={composerInput} aria-label="Message"
            />
            <button style={sendBtn} onClick={sendDraft} disabled={!draft.trim() || room.peerLeft || room.conn !== 'ready'}>Send</button>
          </div>
        </>
      )}

      {/* ---------- LEAVING ---------- */}
      {stage === 'leaving' && (
        <div style={center}>
          <ShushhhMascot size={150} mood="leaving" onDone={finalize} />
          <p style={sub}>Shhh…</p>
        </div>
      )}

      {/* ---------- LEAVE CONFIRM ---------- */}
      <AnimatePresence>
        {confirmLeave && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={scrim}>
            <motion.div initial={{ scale: 0.94, y: 8 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96 }} style={dialog} role="alertdialog" aria-labelledby="sh-leave">
              <div id="sh-leave" style={{ fontSize: 17, fontWeight: 800 }}>Leave Shushhh?</div>
              <div style={{ ...sub, margin: '6px 0 16px' }}>This temporary conversation will disappear from this session.</div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button style={{ ...ghostBtn, flex: 1, margin: 0 }} onClick={() => setConfirmLeave(false)}>Stay</button>
                <button style={{ ...primaryBtn, flex: 1, margin: 0 }} onClick={leave}>Leave</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>,
    document.body
  )
}

function Header({ onLeft, title, subtitle }) {
  return (
    <div style={headerBar}>
      <button style={headerBtn} onClick={onLeft} aria-label="Leave Shushhh"><IconX /></button>
      <div style={{ flex: 1, textAlign: 'center' }}>
        <div style={{ fontSize: 16, fontWeight: 800 }}>{title}</div>
        <div style={{ fontSize: 11.5, opacity: 0.6 }}>{subtitle}</div>
      </div>
      <div style={{ width: 40 }} />
    </div>
  )
}

// ---- styles ----
const shell = {
  position: 'fixed', inset: 0, zIndex: 80, display: 'flex', flexDirection: 'column', color: '#ece8ff',
  background: 'radial-gradient(120% 80% at 50% -10%, #2a1650 0%, #0d0817 55%, #05030a 100%)',
  overscrollBehavior: 'contain', fontFamily: 'inherit',
}
const center = { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, padding: 24, position: 'relative' }
const closeFloat = { position: 'absolute', top: 'max(12px, env(safe-area-inset-top, 0px))', left: 12, width: 40, height: 40, borderRadius: '50%', border: 'none', background: 'rgba(255,255,255,0.07)', color: '#ece8ff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }
const h1 = { fontSize: 26, fontWeight: 800, margin: '10px 0 2px', letterSpacing: 0.3 }
const sub = { fontSize: 14, opacity: 0.75, margin: 0, textAlign: 'center' }
const fine = { fontSize: 11.5, opacity: 0.5, marginTop: 14, textAlign: 'center' }
const noticeBox = { margin: '14px auto 0', maxWidth: 320, padding: '12px 14px', borderRadius: 14, background: 'rgba(139,92,246,0.12)', border: '1px solid rgba(167,139,250,0.25)', fontSize: 13, textAlign: 'left' }
const primaryBtn = { display: 'block', margin: '18px auto 0', padding: '12px 28px', borderRadius: 14, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 750, fontSize: 14.5, color: '#fff', background: 'var(--brand-grad, linear-gradient(135deg,#8b5cf6,#6c63ff))' }
const ghostBtn = { display: 'block', margin: '10px auto 0', padding: '11px 24px', borderRadius: 14, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 650, fontSize: 14, color: '#ece8ff', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)' }
const headerBar = { display: 'flex', alignItems: 'center', gap: 8, padding: 'max(10px, env(safe-area-inset-top, 0px)) 12px 10px', background: 'rgba(13,8,23,0.6)', borderBottom: '1px solid rgba(167,139,250,0.14)', backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)' }
const headerBtn = { width: 40, height: 40, borderRadius: '50%', border: 'none', background: 'rgba(255,255,255,0.07)', color: '#ece8ff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }
const privacyPill = { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, margin: '10px auto 0', padding: '7px 14px', borderRadius: 12, fontSize: 11.5, background: 'rgba(139,92,246,0.10)', border: '1px solid rgba(167,139,250,0.2)', textAlign: 'center', maxWidth: '92%' }
const statusLine = { textAlign: 'center', fontSize: 12, opacity: 0.65, padding: '8px 16px 0' }
const msgList = { flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8, padding: '12px 14px', maxWidth: 720, width: '100%', margin: '0 auto', boxSizing: 'border-box' }
const emptyWrap = { margin: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: 16 }
const bubbleBase = { maxWidth: '78%', padding: '9px 13px', borderRadius: 16, fontSize: 14.5, lineHeight: 1.35, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }
const bubbleMine = { ...bubbleBase, background: 'linear-gradient(135deg,#7c3aed,#5b21b6)', borderBottomRightRadius: 5 }
const bubbleTheirs = { ...bubbleBase, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.08)', borderBottomLeftRadius: 5 }
const composer = { display: 'flex', gap: 8, padding: '10px 12px calc(10px + env(safe-area-inset-bottom, 0px))', borderTop: '1px solid rgba(167,139,250,0.14)', background: 'rgba(13,8,23,0.6)', maxWidth: 720, width: '100%', margin: '0 auto', boxSizing: 'border-box' }
const composerInput = { flex: 1, padding: '11px 14px', borderRadius: 14, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.06)', color: '#ece8ff', fontSize: 14.5, outline: 'none', fontFamily: 'inherit' }
const sendBtn = { padding: '0 18px', borderRadius: 14, border: 'none', color: '#fff', fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', background: 'var(--brand-grad, linear-gradient(135deg,#8b5cf6,#6c63ff))' }
const searchInput = { width: '100%', boxSizing: 'border-box', marginTop: 8, padding: '11px 14px', borderRadius: 14, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.06)', color: '#ece8ff', fontSize: 14.5, outline: 'none', fontFamily: 'inherit' }
const personRow = { display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '10px 8px', border: 'none', borderRadius: 12, background: 'transparent', color: '#ece8ff', cursor: 'pointer', fontFamily: 'inherit', fontSize: 14.5, textAlign: 'left' }
const scrim = { position: 'absolute', inset: 0, background: 'rgba(3,1,8,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)' }
const dialog = { width: '100%', maxWidth: 320, padding: 20, borderRadius: 20, background: '#150d26', border: '1px solid rgba(167,139,250,0.25)' }
