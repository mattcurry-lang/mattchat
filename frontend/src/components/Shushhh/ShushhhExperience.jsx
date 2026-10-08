import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { supabase } from '../../lib/supabase'
import Avatar from '../Avatar'
import ShushhhMascot from './ShushhhMascot'
import { useShushhhRoom, makeRoomTopic, openInviter, loadChatContacts, shushhhBusy } from './useShushhhRoom'

const IconX = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" /></svg>
)
const IconSearch = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="2" /><path d="M16 16l4.5 4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
)
const IconArrow = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
)

const css = `
.sh-person { transition: background .15s ease, border-color .15s ease, transform .15s ease; }
.sh-person:hover { background: rgba(139,92,246,0.14); border-color: rgba(167,139,250,0.35); }
.sh-person:active { transform: scale(0.985); }
.sh-person:focus-visible { outline: 2px solid #a78bfa; outline-offset: 2px; }
.sh-scroll::-webkit-scrollbar { width: 6px; }
.sh-scroll::-webkit-scrollbar-thumb { background: rgba(167,139,250,0.25); border-radius: 6px; }
`

export default function ShushhhExperience({ me, incoming = null, onClose }) {
  const reduce = useReducedMotion()
  const [stage, setStage] = useState('intro') // intro | pick | room | leaving
  const [peer, setPeer] = useState(null)
  const [topic, setTopic] = useState(incoming?.topic || null)
  const [roomActive, setRoomActive] = useState(false)
  const [declining, setDeclining] = useState(false)
  const [confirmLeave, setConfirmLeave] = useState(false)
  const [introDone, setIntroDone] = useState(false)
  const [inviteState, setInviteState] = useState('idle') // idle | sent | failed
  const [inviteErr, setInviteErr] = useState('')
  const [waitedLong, setWaitedLong] = useState(false)
  const [query, setQuery] = useState('')
  const [contacts, setContacts] = useState(null) // null = loading
  const [contactsErr, setContactsErr] = useState('')
  const [draft, setDraft] = useState('')

  const stageRef = useRef(stage); stageRef.current = stage
  const closingRef = useRef(false)
  const doneRef = useRef(false)
  const listRef = useRef(null)

  const room = useShushhhRoom({ topic, me, peerId: peer?.id, active: roomActive })

  const done = useCallback(() => {
    if (doneRef.current) return
    doneRef.current = true
    onClose?.()
  }, [onClose])

  const finalize = useCallback(() => {
    if (closingRef.current) return
    closingRef.current = true
    window.history.back()
    setTimeout(done, 400)
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
      if (e.key === 'Escape' && stageRef.current === 'room') setConfirmLeave((v) => !v)
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
    const t = setTimeout(() => setIntroDone(true), 4500)
    return () => clearTimeout(t)
  }, [stage])
  useEffect(() => {
    if (stage !== 'leaving') return undefined
    const t = setTimeout(() => finalize(), 2000)
    return () => clearTimeout(t)
  }, [stage, finalize])

  // incoming: who invited us
  useEffect(() => {
    if (!incoming) return
    supabase.from('profiles').select('id, username, avatar_url').eq('id', incoming.fromId).single()
      .then(({ data }) => setPeer(data || { id: incoming.fromId, username: 'Someone', avatar_url: null }))
  }, [incoming])

  // host: load only the people you chat with
  useEffect(() => {
    if (stage !== 'pick' || contacts) return
    loadChatContacts(me)
      .then(setContacts)
      .catch((e) => { setContactsErr(e?.message || 'Could not load your chats'); setContacts([]) })
  }, [stage, contacts, me])

  const shown = useMemo(() => {
    if (!contacts) return []
    const q = query.trim().toLowerCase()
    return q ? contacts.filter((u) => u.username.toLowerCase().includes(q)) : contacts
  }, [contacts, query])

  // host: keep inviting (every 4s, max 8 tries) until the other person is in the room
  useEffect(() => {
    if (incoming || stage !== 'room' || room.conn !== 'ready' || !peer || room.peerHere || room.peerLeft) return undefined
    let cancelled = false
    let inviter = null
    let timer = null
    let tries = 0

    const tick = async () => {
      if (cancelled || tries >= 8) return
      tries += 1
      try {
        if (!inviter) {
          const opened = await openInviter(peer.id)
          if (cancelled) { opened.close(); return }
          inviter = opened
        }
        const r = await inviter.send({ topic, from: me })
        if (!cancelled) { setInviteState(r === 'ok' ? 'sent' : 'failed'); setInviteErr(r === 'ok' ? '' : String(r)) }
      } catch (e) {
        if (!cancelled) { setInviteState('failed'); setInviteErr(e?.message || 'error') }
      }
      if (!cancelled) timer = setTimeout(tick, 4000)
    }
    timer = setTimeout(tick, 60) // small delay so a StrictMode remount never double-opens
    return () => { cancelled = true; clearTimeout(timer); inviter?.close() }
  }, [incoming, stage, room.conn, room.peerHere, room.peerLeft, peer, topic, me])

  useEffect(() => {
    if (stage !== 'room' || incoming || room.peerHere) { setWaitedLong(false); return undefined }
    const t = setTimeout(() => setWaitedLong(true), 45000)
    return () => clearTimeout(t)
  }, [stage, incoming, room.peerHere])

  // decline: join briefly so the host gets a "left" signal, then close
  useEffect(() => {
    if (!declining) return undefined
    const t = setTimeout(() => finalize(), 3000)
    if (room.conn === 'ready') { setRoomActive(false); finalize() }
    return () => clearTimeout(t)
  }, [declining, room.conn, finalize])

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: reduce ? 'auto' : 'smooth' })
  }, [room.messages.length, reduce])

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
    setRoomActive(false)
    setStage('leaving')
  }
  const sendDraft = () => { const t = draft; setDraft(''); room.send(t) }

  const name = peer?.username || 'them'
  const showText = introDone || reduce

  return createPortal(
    <div style={shell} role="dialog" aria-modal="true" aria-label="Shushhh">
      <style>{css}</style>

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
          <div style={pickWrap}>
            <div style={pickHero}>
              <ShushhhMascot size={64} mood="curious" />
              <div>
                <div style={pickTitle}>Whisper to…</div>
                <div style={{ ...sub, textAlign: 'left', marginTop: 2 }}>Pick someone you already chat with</div>
              </div>
            </div>

            <div style={searchBox}>
              <span style={{ opacity: 0.55, display: 'flex' }}><IconSearch /></span>
              <input
                value={query} onChange={(e) => setQuery(e.target.value)}
                placeholder="Search your chats" autoComplete="off" autoCorrect="off" spellCheck={false}
                style={searchField} aria-label="Search your chats"
              />
            </div>

            {contacts && contacts.length > 0 && (
              <div style={listLabel}>Your chats · {shown.length}</div>
            )}

            <div className="sh-scroll" style={pickList}>
              {contacts === null && <div style={listEmpty}>Loading your chats…</div>}
              {contactsErr && <div style={{ ...listEmpty, color: '#fca5a5' }}>Couldn't load your chats ({contactsErr})</div>}
              {contacts && !contactsErr && contacts.length === 0 && (
                <div style={listEmpty}>No one yet. Start a normal chat with someone first, then you can whisper to them here.</div>
              )}
              {contacts && contacts.length > 0 && shown.length === 0 && <div style={listEmpty}>No chats match "{query}"</div>}

              {shown.map((u, i) => (
                <motion.button
                  key={u.id} className="sh-person" style={personRow}
                  initial={reduce ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(i, 10) * 0.035, type: 'spring', stiffness: 380, damping: 30 }}
                  onClick={() => startRoom(u)}
                >
                  <span style={avatarRing}><Avatar name={u.username} size={42} photoUrl={u.avatar_url} /></span>
                  <span style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                    <span style={personName}>{u.username}</span>
                    <span style={personSub}>Tap to whisper 🤫</span>
                  </span>
                  <span style={whisperPill}>Whisper <IconArrow /></span>
                </motion.button>
              ))}
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
            {room.conn === 'error' ? `Couldn't connect to the room (${room.error || 'unknown'}). Leave and try again.`
              : room.peerLeft ? `${name} left Shushhh. This room is closed.`
              : room.peerHere ? `${name} is here`
              : inviteState === 'failed' ? `Couldn't reach ${name} yet${inviteErr ? ` (${inviteErr})` : ''}. Retrying…`
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
const center = { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, padding: 24, position: 'relative', overflow: 'hidden' }
const closeFloat = { position: 'absolute', top: 'max(12px, env(safe-area-inset-top, 0px))', left: 12, width: 40, height: 40, borderRadius: '50%', border: 'none', background: 'rgba(255,255,255,0.07)', color: '#ece8ff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }
const h1 = { fontSize: 26, fontWeight: 800, margin: '10px 0 2px', letterSpacing: 0.3 }
const sub = { fontSize: 14, opacity: 0.75, margin: 0, textAlign: 'center' }
const fine = { fontSize: 11.5, opacity: 0.5, marginTop: 14, textAlign: 'center' }
const noticeBox = { margin: '14px auto 0', maxWidth: 320, padding: '12px 14px', borderRadius: 14, background: 'rgba(139,92,246,0.12)', border: '1px solid rgba(167,139,250,0.25)', fontSize: 13, textAlign: 'left' }
const primaryBtn = { display: 'block', margin: '18px auto 0', padding: '12px 28px', borderRadius: 14, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 750, fontSize: 14.5, color: '#fff', background: 'var(--brand-grad, linear-gradient(135deg,#8b5cf6,#6c63ff))' }
const ghostBtn = { display: 'block', margin: '10px auto 0', padding: '11px 24px', borderRadius: 14, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 650, fontSize: 14, color: '#ece8ff', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)' }
const headerBar = { display: 'flex', alignItems: 'center', gap: 8, padding: 'max(10px, env(safe-area-inset-top, 0px)) 12px 10px', background: 'rgba(13,8,23,0.6)', borderBottom: '1px solid rgba(167,139,250,0.14)', backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)', flexShrink: 0 }
const headerBtn = { width: 40, height: 40, borderRadius: '50%', border: 'none', background: 'rgba(255,255,255,0.07)', color: '#ece8ff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }

// pick
const pickWrap = { flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', width: '100%', maxWidth: 560, margin: '0 auto', padding: '14px 16px 0', boxSizing: 'border-box' }
const pickHero = { display: 'flex', alignItems: 'center', gap: 14, padding: '6px 4px 12px', flexShrink: 0 }
const pickTitle = { fontSize: 22, fontWeight: 800, letterSpacing: 0.2 }
const searchBox = { display: 'flex', alignItems: 'center', gap: 10, padding: '0 14px', borderRadius: 16, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(167,139,250,0.2)', flexShrink: 0 }
const searchField = { flex: 1, padding: '12px 0', border: 'none', outline: 'none', background: 'transparent', color: '#ece8ff', fontSize: 14.5, fontFamily: 'inherit' }
const listLabel = { fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6, opacity: 0.5, margin: '16px 4px 8px', flexShrink: 0 }
const pickList = { flex: 1, minHeight: 0, overflowY: 'auto', overscrollBehavior: 'contain', WebkitOverflowScrolling: 'touch', display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 2, paddingBottom: 'calc(28px + env(safe-area-inset-bottom, 0px))' }
const listEmpty = { textAlign: 'center', opacity: 0.6, fontSize: 13.5, padding: '36px 20px', lineHeight: 1.45 }
const personRow = { display: 'flex', alignItems: 'center', gap: 12, width: '100%', flexShrink: 0, padding: '10px 12px', borderRadius: 18, border: '1px solid rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.04)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', color: '#ece8ff', cursor: 'pointer', fontFamily: 'inherit', boxSizing: 'border-box' }
const avatarRing = { display: 'inline-flex', padding: 2, borderRadius: '50%', background: 'linear-gradient(135deg,#8b5cf6,#6c63ff)', flexShrink: 0 }
const personName = { display: 'block', fontSize: 15, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }
const personSub = { display: 'block', fontSize: 11.5, opacity: 0.55, marginTop: 1 }
const whisperPill = { display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11.5, fontWeight: 700, padding: '6px 10px', borderRadius: 999, background: 'rgba(139,92,246,0.18)', color: '#c4b5fd', flexShrink: 0 }

// room
const privacyPill = { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, margin: '10px auto 0', padding: '7px 14px', borderRadius: 12, fontSize: 11.5, background: 'rgba(139,92,246,0.10)', border: '1px solid rgba(167,139,250,0.2)', textAlign: 'center', maxWidth: '92%', flexShrink: 0 }
const statusLine = { textAlign: 'center', fontSize: 12, opacity: 0.65, padding: '8px 16px 0', flexShrink: 0 }
const msgList = { flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8, padding: '12px 14px', maxWidth: 720, width: '100%', margin: '0 auto', boxSizing: 'border-box' }
const emptyWrap = { margin: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: 16 }
const bubbleBase = { maxWidth: '78%', padding: '9px 13px', borderRadius: 16, fontSize: 14.5, lineHeight: 1.35, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }
const bubbleMine = { ...bubbleBase, background: 'linear-gradient(135deg,#7c3aed,#5b21b6)', borderBottomRightRadius: 5 }
const bubbleTheirs = { ...bubbleBase, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.08)', borderBottomLeftRadius: 5 }
const composer = { display: 'flex', gap: 8, padding: '10px 12px calc(10px + env(safe-area-inset-bottom, 0px))', borderTop: '1px solid rgba(167,139,250,0.14)', background: 'rgba(13,8,23,0.6)', maxWidth: 720, width: '100%', margin: '0 auto', boxSizing: 'border-box', flexShrink: 0 }
const composerInput = { flex: 1, padding: '11px 14px', borderRadius: 14, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.06)', color: '#ece8ff', fontSize: 14.5, outline: 'none', fontFamily: 'inherit' }
const sendBtn = { padding: '0 18px', borderRadius: 14, border: 'none', color: '#fff', fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', background: 'var(--brand-grad, linear-gradient(135deg,#8b5cf6,#6c63ff))' }
const scrim = { position: 'absolute', inset: 0, background: 'rgba(3,1,8,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)' }
const dialog = { width: '100%', maxWidth: 320, padding: 20, borderRadius: 20, background: '#150d26', border: '1px solid rgba(167,139,250,0.25)' }
