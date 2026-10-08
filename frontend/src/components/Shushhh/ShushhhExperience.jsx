import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { supabase } from '../../lib/supabase'
import Avatar from '../Avatar'
import ShushhhMascot from './ShushhhMascot'
import { useShushhhRoom, makeRoomTopic, openInviter, loadChatContacts, declineInvite, shushhhBusy } from './useShushhhRoom'

const IconX = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" /></svg>
)
const IconSearch = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="2" /><path d="M16 16l4.5 4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
)
const IconArrow = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
)
const IconSend = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M4 12l16-8-6 16-3-7-7-1z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" /></svg>
)
const IconLock = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><rect x="5" y="11" width="14" height="9" rx="2.5" stroke="currentColor" strokeWidth="2" /><path d="M8 11V8a4 4 0 018 0v3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
)

const css = `
.sh-person { transition: background .15s ease, border-color .15s ease, transform .15s ease; }
.sh-person:hover { background: rgba(139,92,246,0.14); border-color: rgba(167,139,250,0.35); }
.sh-person:active { transform: scale(0.985); }
.sh-person:focus-visible { outline: 2px solid #a78bfa; outline-offset: 2px; }
.sh-scroll::-webkit-scrollbar { width: 6px; }
.sh-scroll::-webkit-scrollbar-thumb { background: rgba(167,139,250,0.25); border-radius: 6px; }
.sh-ta::placeholder { color: rgba(236,232,255,0.4); }
.sh-dot { width: 6px; height: 6px; border-radius: 50%; background: #c4b5fd; display: inline-block; animation: shBounce 1s infinite ease-in-out; }
.sh-dot:nth-child(2) { animation-delay: .15s; }
.sh-dot:nth-child(3) { animation-delay: .3s; }
@keyframes shBounce { 0%, 60%, 100% { transform: translateY(0); opacity: .5; } 30% { transform: translateY(-4px); opacity: 1; } }
@keyframes shPulse { 0%, 100% { opacity: .55; transform: scale(1); } 50% { opacity: 1; transform: scale(1.35); } }
@media (prefers-reduced-motion: reduce) { .sh-dot, .sh-live { animation: none !important; } }
`

function Ambient({ reduce }) {
  const orb = (key, style, animate, dur) => (
    <motion.div
      key={key} style={style}
      animate={reduce ? undefined : animate}
      transition={{ duration: dur, repeat: Infinity, repeatType: 'mirror', ease: 'easeInOut' }}
    />
  )
  return (
    <div style={ambientWrap} aria-hidden="true">
      {orb('a', orbA, { x: [0, 50, -20], y: [0, 40, -10] }, 14)}
      {orb('b', orbB, { x: [0, -60, 20], y: [0, -40, 20] }, 18)}
      {orb('c', orbC, { x: [0, 30, -30], y: [0, -20, 30] }, 22)}
      <div style={grain} />
      <div style={vignette} />
    </div>
  )
}

export default function ShushhhExperience({ me, incoming = null, skipIntro = false, onClose }) {
  const reduce = useReducedMotion()
  const direct = Boolean(incoming && skipIntro)

  const [stage, setStage] = useState(direct ? 'room' : 'intro') // intro | pick | room | leaving
  const [peer, setPeer] = useState(incoming?.peer || null)
  const [topic, setTopic] = useState(incoming?.topic || null)
  const [roomActive, setRoomActive] = useState(direct)
  const [declining, setDeclining] = useState(false)
  const [confirmLeave, setConfirmLeave] = useState(false)
  const [introDone, setIntroDone] = useState(false)
  const [inviteState, setInviteState] = useState('idle')
  const [inviteErr, setInviteErr] = useState('')
  const [waitedLong, setWaitedLong] = useState(false)
  const [query, setQuery] = useState('')
  const [contacts, setContacts] = useState(null)
  const [contactsErr, setContactsErr] = useState('')
  const [draft, setDraft] = useState('')
  const [ghost, setGhost] = useState([]) // cosmetic dissolve on leave, discarded within ~2s

  const stageRef = useRef(stage); stageRef.current = stage
  const closingRef = useRef(false)
  const doneRef = useRef(false)
  const listRef = useRef(null)
  const taRef = useRef(null)
  const typingOn = useRef(false)
  const typingTimer = useRef(null)

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
    const t = setTimeout(() => setIntroDone(true), 5500)
    return () => clearTimeout(t)
  }, [stage])
  useEffect(() => {
    if (stage !== 'leaving') return undefined
    const t = setTimeout(() => finalize(), 2200)
    return () => clearTimeout(t)
  }, [stage, finalize])

  // incoming without a preloaded profile
  useEffect(() => {
    if (!incoming || peer) return
    supabase.from('profiles').select('id, username, avatar_url').eq('id', incoming.fromId).single()
      .then(({ data }) => setPeer(data || { id: incoming.fromId, username: 'Someone', avatar_url: null }))
  }, [incoming, peer])

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
    timer = setTimeout(tick, 60)
    return () => { cancelled = true; clearTimeout(timer); inviter?.close() }
  }, [incoming, stage, room.conn, room.peerHere, room.peerLeft, peer, topic, me])

  useEffect(() => {
    if (stage !== 'room' || incoming || room.peerHere) { setWaitedLong(false); return undefined }
    const t = setTimeout(() => setWaitedLong(true), 45000)
    return () => clearTimeout(t)
  }, [stage, incoming, room.peerHere])

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: reduce ? 'auto' : 'smooth' })
  }, [room.messages.length, room.peerTyping, reduce])

  const enter = () => { setStage('pick') }
  const decline = async () => {
    setDeclining(true)
    try { await declineInvite(topic, me) } catch { /* noop */ }
    finalize()
  }
  const startRoom = (user) => {
    setPeer(user)
    setTopic(makeRoomTopic(me, user.id))
    setRoomActive(true)
    setStage('room')
  }
  const leave = () => {
    clearTimeout(typingTimer.current)
    setGhost(room.messages.slice(-6).map((m) => ({ id: m.id, mine: m.from === me, text: m.text.slice(0, 80) })))
    setConfirmLeave(false)
    setRoomActive(false) // tears down the channel + wipes the real messages immediately
    setStage('leaving')
  }

  const stopTyping = () => {
    clearTimeout(typingTimer.current)
    if (typingOn.current) { typingOn.current = false; room.sendTyping(false) }
  }
  const onDraftChange = (e) => {
    const el = e.target
    setDraft(el.value)
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`
    if (!typingOn.current) { typingOn.current = true; room.sendTyping(true) }
    clearTimeout(typingTimer.current)
    typingTimer.current = setTimeout(stopTyping, 1600)
  }
  const sendDraft = () => {
    const t = draft.trim()
    if (!t) return
    setDraft('')
    if (taRef.current) taRef.current.style.height = 'auto'
    stopTyping()
    room.send(t)
  }

  const name = peer?.username || 'them'
  const showText = introDone || reduce
  const canType = !room.peerLeft && room.conn === 'ready'

  const statusText =
    room.conn === 'error' ? `Couldn't connect (${room.error || 'unknown'}). Leave and try again.`
    : room.peerLeft ? `${name} left Shushhh. This room is closed.`
    : room.peerHere ? `${name} is here`
    : inviteState === 'failed' ? `Couldn't reach ${name} yet${inviteErr ? ` (${inviteErr})` : ''}. Retrying…`
    : waitedLong ? `No response from ${name} yet. They may be offline.`
    : incoming ? 'Connecting…'
    : `Whispering to ${name}…`

  return createPortal(
    <div style={shell} role="dialog" aria-modal="true" aria-label="Shushhh">
      <style>{css}</style>
      <Ambient reduce={reduce} />

      <div style={layer}>
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
            <Header onLeft={finalize} />
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

              {contacts && contacts.length > 0 && <div style={listLabel}>Your chats · {shown.length}</div>}

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
            <Header onLeft={() => setConfirmLeave(true)} right={<PeerBadge peer={peer} present={room.peerHere} />} />

            <div style={infoRow}>
              <div style={privacyChip}><IconLock /> This chat disappears when you leave.</div>
              <div style={statusPill}>
                <span className="sh-live" style={{ ...liveDot, background: room.peerHere ? '#a78bfa' : 'rgba(255,255,255,0.3)', animation: room.peerHere ? 'shPulse 2s infinite' : 'none' }} />
                <span>{statusText}</span>
              </div>
            </div>

            <div ref={listRef} className="sh-scroll" style={msgList}>
              {incoming && (
                <div style={noticeCard}>
                  <div style={{ fontWeight: 700 }}>You're entering a Shushhh conversation.</div>
                  <div style={{ opacity: 0.7, marginTop: 3 }}>Messages here aren't added to your normal Mattchat chat history.</div>
                </div>
              )}

              {room.messages.length === 0 ? (
                <div style={emptyWrap}>
                  <ShushhhMascot size={88} mood="curious" />
                  <div style={{ fontWeight: 800, fontSize: 17, marginTop: 8 }}>Psst...</div>
                  <div style={{ ...sub, margin: '4px 0' }}>Nothing said here goes into your normal chat history.</div>
                  <div style={sub}>Go ahead. I'm listening. 🤫</div>
                </div>
              ) : room.messages.map((m, i) => {
                const mine = m.from === me
                const prev = room.messages[i - 1]
                const next = room.messages[i + 1]
                const first = !prev || prev.from !== m.from
                const last = !next || next.from !== m.from
                return (
                  <motion.div
                    key={m.id}
                    initial={reduce ? false : { opacity: 0, y: 10, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ type: 'spring', stiffness: 420, damping: 30 }}
                    style={{ ...msgRow(mine), marginTop: first ? 8 : 0 }}
                  >
                    {!mine && <div style={{ width: 28, flexShrink: 0 }}>{last && peer && <Avatar name={peer.username} size={28} photoUrl={peer.avatar_url} />}</div>}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: mine ? 'flex-end' : 'flex-start', maxWidth: '78%' }}>
                      <div style={bubble(mine, first, last)}>{m.text}</div>
                      {last && (
                        <div style={meta}>
                          {new Date(m.ts).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                          {m.state === 'failed' && <span style={{ color: '#fca5a5' }}> · Not delivered</span>}
                          {mine && m.state === 'sending' && ' · …'}
                        </div>
                      )}
                    </div>
                  </motion.div>
                )
              })}

              {room.peerTyping && (
                <div style={msgRow(false)}>
                  <div style={{ width: 28, flexShrink: 0 }}>{peer && <Avatar name={peer.username} size={28} photoUrl={peer.avatar_url} />}</div>
                  <div style={{ ...bubble(false, true, true), display: 'flex', gap: 4, padding: '13px 15px' }}>
                    <i className="sh-dot" /><i className="sh-dot" /><i className="sh-dot" />
                  </div>
                </div>
              )}
            </div>

            <div style={composerWrap}>
              <div style={{ ...composerPill, opacity: canType ? 1 : 0.6 }}>
                <textarea
                  ref={taRef} className="sh-ta" rows={1}
                  value={draft} onChange={onDraftChange}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendDraft() } }}
                  placeholder={room.peerLeft ? 'Room closed' : 'Whisper something…'}
                  disabled={!canType} maxLength={2000}
                  name="shushhh-message" autoComplete="off" autoCorrect="off" autoCapitalize="sentences"
                  spellCheck={false} enterKeyHint="send" style={composerInput} aria-label="Message"
                />
                <motion.button
                  whileTap={{ scale: 0.88 }} onClick={sendDraft}
                  disabled={!draft.trim() || !canType}
                  style={{ ...sendRound, opacity: draft.trim() && canType ? 1 : 0.4 }} aria-label="Send"
                >
                  <IconSend />
                </motion.button>
              </div>
            </div>
          </>
        )}

        {/* ---------- LEAVING ---------- */}
        {stage === 'leaving' && (
          <div style={center}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: 'min(420px, 90%)', marginBottom: 18 }}>
              {ghost.map((g, i) => (
                <motion.div
                  key={g.id}
                  initial={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                  animate={reduce ? { opacity: 0 } : { opacity: 0, y: -22, filter: 'blur(10px)' }}
                  transition={{ duration: 0.75, delay: 0.05 + i * 0.07, ease: 'easeIn' }}
                  style={{ alignSelf: g.mine ? 'flex-end' : 'flex-start', ...bubble(g.mine, true, true), maxWidth: '75%' }}
                >
                  {g.text}
                </motion.div>
              ))}
            </div>
            <ShushhhMascot size={150} mood="leaving" onDone={finalize} />
            <p style={sub}>Shhh…</p>
          </div>
        )}
      </div>

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

function Header({ onLeft, right }) {
  return (
    <div style={headerBar}>
      <button style={headerBtn} onClick={onLeft} aria-label="Leave Shushhh"><IconX /></button>
      <div style={{ flex: 1, textAlign: 'center' }}>
        <div style={{ fontSize: 16, fontWeight: 800, letterSpacing: 0.3 }}>Shushhh</div>
        <div style={{ fontSize: 11.5, opacity: 0.6 }}>Temporary conversation</div>
      </div>
      {right || <div style={{ width: 40 }} />}
    </div>
  )
}

function PeerBadge({ peer, present }) {
  if (!peer) return <div style={{ width: 40 }} />
  return (
    <div style={{ width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <span style={{
        display: 'inline-flex', borderRadius: '50%', transition: 'box-shadow .4s ease',
        boxShadow: present
          ? '0 0 0 2px rgba(167,139,250,0.95), 0 0 16px 3px rgba(139,92,246,0.55)'
          : '0 0 0 2px rgba(255,255,255,0.12)',
      }}>
        <Avatar name={peer.username} size={36} photoUrl={peer.avatar_url} />
      </span>
    </div>
  )
}

// ---- styles ----
const shell = { position: 'fixed', inset: 0, zIndex: 80, display: 'flex', flexDirection: 'column', color: '#ece8ff', background: '#07050d', overscrollBehavior: 'contain', fontFamily: 'inherit', overflow: 'hidden' }
const layer = { position: 'relative', zIndex: 1, flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }

const ambientWrap = { position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }
const orbBase = { position: 'absolute', borderRadius: '50%', filter: 'blur(48px)' }
const orbA = { ...orbBase, width: 460, height: 460, top: -140, left: -120, background: 'radial-gradient(circle, rgba(124,58,237,0.42), transparent 65%)' }
const orbB = { ...orbBase, width: 520, height: 520, bottom: -200, right: -160, background: 'radial-gradient(circle, rgba(99,102,241,0.30), transparent 65%)' }
const orbC = { ...orbBase, width: 340, height: 340, top: '38%', left: '55%', background: 'radial-gradient(circle, rgba(167,139,250,0.20), transparent 65%)' }
const grain = { position: 'absolute', inset: 0, opacity: 0.5, backgroundImage: 'radial-gradient(rgba(255,255,255,0.045) 1px, transparent 1px)', backgroundSize: '3px 3px' }
const vignette = { position: 'absolute', inset: 0, background: 'radial-gradient(120% 90% at 50% 40%, transparent 55%, rgba(0,0,0,0.55) 100%)' }

const center = { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, padding: 24, position: 'relative', overflow: 'hidden' }
const closeFloat = { position: 'absolute', top: 'max(12px, env(safe-area-inset-top, 0px))', left: 12, width: 40, height: 40, borderRadius: '50%', border: 'none', background: 'rgba(255,255,255,0.07)', color: '#ece8ff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }
const h1 = { fontSize: 26, fontWeight: 800, margin: '10px 0 2px', letterSpacing: 0.3 }
const sub = { fontSize: 14, opacity: 0.75, margin: 0, textAlign: 'center' }
const fine = { fontSize: 11.5, opacity: 0.5, marginTop: 14, textAlign: 'center' }
const primaryBtn = { display: 'block', margin: '18px auto 0', padding: '12px 28px', borderRadius: 14, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 750, fontSize: 14.5, color: '#fff', background: 'var(--brand-grad, linear-gradient(135deg,#8b5cf6,#6c63ff))', boxShadow: '0 8px 24px rgba(124,58,237,0.35)' }
const ghostBtn = { display: 'block', margin: '10px auto 0', padding: '11px 24px', borderRadius: 14, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 650, fontSize: 14, color: '#ece8ff', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)' }

const headerBar = { display: 'flex', alignItems: 'center', gap: 8, padding: 'max(10px, env(safe-area-inset-top, 0px)) 12px 10px', background: 'rgba(13,8,23,0.55)', borderBottom: '1px solid rgba(167,139,250,0.14)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', flexShrink: 0 }
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
const infoRow = { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '10px 14px 0', flexShrink: 0 }
const privacyChip = { display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11.5, padding: '5px 12px', borderRadius: 999, color: '#d8ccff', background: 'rgba(139,92,246,0.12)', border: '1px solid rgba(167,139,250,0.22)', textAlign: 'center' }
const statusPill = { display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 12, opacity: 0.8, textAlign: 'center', maxWidth: '94%' }
const liveDot = { width: 7, height: 7, borderRadius: '50%', flexShrink: 0 }
const msgList = { flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 3, padding: '10px 14px 14px', maxWidth: 720, width: '100%', margin: '0 auto', boxSizing: 'border-box' }
const noticeCard = { alignSelf: 'center', textAlign: 'center', fontSize: 12.5, padding: '10px 14px', borderRadius: 14, background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(167,139,250,0.2)', maxWidth: 340, marginBottom: 6 }
const emptyWrap = { margin: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: 16 }
const msgRow = (mine) => ({ display: 'flex', alignItems: 'flex-end', gap: 6, justifyContent: mine ? 'flex-end' : 'flex-start' })
const bubble = (mine, first, last) => ({
  padding: '9px 13px', fontSize: 14.5, lineHeight: 1.38, whiteSpace: 'pre-wrap', wordBreak: 'break-word', color: '#f5f2ff',
  borderRadius: mine ? `18px ${first ? 18 : 6}px ${last ? 5 : 6}px 18px` : `${first ? 18 : 6}px 18px 18px ${last ? 5 : 6}px`,
  ...(mine
    ? { background: 'linear-gradient(135deg,#8b5cf6,#6d28d9)', boxShadow: '0 6px 20px rgba(124,58,237,0.32)' }
    : { background: 'rgba(255,255,255,0.075)', border: '1px solid rgba(255,255,255,0.09)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }),
})
const meta = { fontSize: 10.5, opacity: 0.45, marginTop: 3, padding: '0 4px' }
const composerWrap = { padding: '8px 12px calc(12px + env(safe-area-inset-bottom, 0px))', maxWidth: 720, width: '100%', margin: '0 auto', boxSizing: 'border-box', flexShrink: 0 }
const composerPill = { display: 'flex', alignItems: 'flex-end', gap: 8, padding: '6px 6px 6px 16px', borderRadius: 26, background: 'rgba(255,255,255,0.075)', border: '1px solid rgba(167,139,250,0.25)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', boxShadow: '0 10px 30px rgba(0,0,0,0.35)', transition: 'opacity .2s ease' }
const composerInput = { flex: 1, resize: 'none', padding: '9px 0', border: 'none', outline: 'none', background: 'transparent', color: '#ece8ff', fontSize: 14.5, fontFamily: 'inherit', lineHeight: 1.35, maxHeight: 120 }
const sendRound = { width: 40, height: 40, borderRadius: '50%', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, background: 'var(--brand-grad, linear-gradient(135deg,#8b5cf6,#6c63ff))', boxShadow: '0 6px 18px rgba(124,58,237,0.4)', transition: 'opacity .2s ease' }
const scrim = { position: 'absolute', inset: 0, zIndex: 3, background: 'rgba(3,1,8,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)' }
const dialog = { width: '100%', maxWidth: 320, padding: 20, borderRadius: 20, background: '#150d26', border: '1px solid rgba(167,139,250,0.25)' }
