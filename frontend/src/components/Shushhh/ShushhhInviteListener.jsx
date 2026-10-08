import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { supabase } from '../../lib/supabase'
import Avatar from '../Avatar'
import ShushhhExperience from './ShushhhExperience'
import { declineInvite, ensureRealtimeAuth, inboxTopic, parseRoomTopic, shushhhBusy } from './useShushhhRoom'

// Module-level so a StrictMode remount reuses the same channel.
let inbox = null // { me, ch, timer, onInvite }

const FLIGHT = {
  x: ['18vw', '-14vw', '8vw', '-3vw', '0vw'],
  y: ['82vh', '52vh', '26vh', '7vh', '0vh'],
  scale: [0.4, 0.85, 1, 1.2, 1],
}

export default function ShushhhInviteListener({ me }) {
  const reduce = useReducedMotion()
  const [incoming, setIncoming] = useState(null) // { topic, fromId, peer }
  const [phase, setPhase] = useState('dot')      // dot | card | room
  const handled = useRef(new Set())
  const incomingRef = useRef(null)
  incomingRef.current = incoming

  useEffect(() => {
    if (!me) return undefined

    if (inbox && inbox.me === me) {
      clearTimeout(inbox.timer)
      inbox.timer = null
    } else {
      if (inbox) { supabase.removeChannel(inbox.ch); inbox = null }
      const ch = supabase.channel(inboxTopic(me), { config: { private: true, broadcast: { self: false } } })
      const entry = { me, ch, timer: null, onInvite: null }
      inbox = entry
      ch.on('broadcast', { event: 'invite' }, (msg) => entry.onInvite?.(msg.payload))
      ensureRealtimeAuth().then(() => {
        if (inbox !== entry) return
        ch.subscribe((status, err) => {
          if (status === 'SUBSCRIBED') console.info('[Shushhh] inbox ready')
          if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') console.warn('[Shushhh] inbox', status, err?.message || '')
        })
      })
    }

    const cur = inbox
    cur.onInvite = (payload) => {
      const p = parseRoomTopic(payload?.topic)
      if (!p || p.b !== me || p.a !== payload.from) return
      if (handled.current.has(payload.topic) || shushhhBusy.current || incomingRef.current) return
      handled.current.add(payload.topic)
      console.info('[Shushhh] invite received')
      setPhase('dot')
      setIncoming({ topic: payload.topic, fromId: payload.from, peer: null })
      supabase.from('profiles').select('id, username, avatar_url').eq('id', payload.from).single()
        .then(({ data }) => setIncoming((c) => (c && c.topic === payload.topic ? { ...c, peer: data || { id: payload.from, username: 'Someone', avatar_url: null } } : c)))
    }

    return () => {
      cur.onInvite = null
      cur.timer = setTimeout(() => {
        if (inbox === cur) { supabase.removeChannel(cur.ch); inbox = null }
      }, 150)
    }
  }, [me])

  // the dot quietly disappears if ignored for 2 minutes
  useEffect(() => {
    if (!incoming || phase === 'room') return undefined
    const t = setTimeout(() => setIncoming(null), 120000)
    return () => clearTimeout(t)
  }, [incoming, phase])

  useEffect(() => {
    if (phase !== 'card') return undefined
    const onKey = (e) => { if (e.key === 'Escape') setPhase('dot') }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [phase])

  const decline = () => {
    const t = incoming?.topic
    setIncoming(null)
    if (t) declineInvite(t, me)
  }

  return (
    <>
      {incoming && phase !== 'room' && (
        <FlyingDot key={incoming.topic} reduce={reduce} onClick={() => setPhase((p) => (p === 'card' ? 'dot' : 'card'))} />
      )}
      <AnimatePresence>
        {incoming && phase === 'card' && (
          <InviteCard
            peer={incoming.peer}
            onEnter={() => setPhase('room')}
            onDecline={decline}
            onBackdrop={() => setPhase('dot')}
          />
        )}
      </AnimatePresence>
      {incoming && phase === 'room' && (
        <ShushhhExperience key={incoming.topic} me={me} incoming={incoming} skipIntro onClose={() => setIncoming(null)} />
      )}
    </>
  )
}

function FlyingDot({ onClick, reduce }) {
  const [landed, setLanded] = useState(Boolean(reduce))
  const flight = { duration: 1.25, ease: 'easeInOut' }

  return createPortal(
    <div style={dotAnchor}>
      {!reduce && [0, 1, 2, 3].map((n) => (
        <motion.span
          key={n}
          style={trail(n)}
          initial={{ opacity: 0 }}
          animate={{ x: FLIGHT.x, y: FLIGHT.y, scale: FLIGHT.scale.map((s) => s * 0.8), opacity: [0, 0.7, 0.5, 0.3, 0] }}
          transition={{ ...flight, delay: 0.07 * (n + 1) }}
        />
      ))}
      <motion.button
        aria-label="Shushhh invitation"
        onClick={onClick}
        style={dotBtn}
        initial={reduce ? { opacity: 0 } : { opacity: 0, x: FLIGHT.x[0], y: FLIGHT.y[0], scale: 0.4 }}
        animate={reduce ? { opacity: 1 } : { opacity: [0, 1, 1, 1, 1], x: FLIGHT.x, y: FLIGHT.y, scale: FLIGHT.scale }}
        transition={flight}
        onAnimationComplete={() => setLanded(true)}
        whileTap={{ scale: 0.85 }}
      >
        {landed && !reduce && (
          <motion.span
            style={dotRing}
            animate={{ scale: [1, 2.6], opacity: [0.6, 0] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: 'easeOut' }}
          />
        )}
        <motion.span
          style={dotCore}
          animate={landed && !reduce ? { y: [0, -2.5, 0] } : undefined}
          transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
        />
      </motion.button>
    </div>,
    document.body
  )
}

function InviteCard({ peer, onEnter, onDecline, onBackdrop }) {
  return createPortal(
    <>
      <div style={cardBackdrop} onClick={onBackdrop} />
      <div style={cardWrap}>
        <motion.div
          role="dialog" aria-label="Shushhh invitation"
          initial={{ opacity: 0, y: -10, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -8, scale: 0.97 }}
          transition={{ type: 'spring', stiffness: 420, damping: 30 }}
          style={card}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={cardRing}><Avatar name={peer?.username || '?'} size={40} photoUrl={peer?.avatar_url} /></span>
            <div style={{ minWidth: 0 }}>
              <div style={cardName}>{peer ? `${peer.username} whispered` : 'Someone whispered'}</div>
              <div style={cardSub}>Shushhh · temporary room</div>
            </div>
          </div>
          <div style={cardNote}>
            You're entering a Shushhh conversation. Messages here aren't added to your normal Mattchat chat history.
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button style={cardGhost} onClick={onDecline}>Not now</button>
            <button style={cardPrimary} onClick={onEnter}>Enter</button>
          </div>
        </motion.div>
      </div>
    </>,
    document.body
  )
}

const dotAnchor = { position: 'fixed', top: 'calc(env(safe-area-inset-top, 0px) + 14px)', left: '50%', width: 0, height: 0, zIndex: 75, pointerEvents: 'none' }
const dotBtn = { position: 'absolute', left: -22, top: -22, width: 44, height: 44, border: 'none', background: 'transparent', padding: 0, cursor: 'pointer', pointerEvents: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }
const dotCore = { width: 13, height: 13, borderRadius: '50%', background: 'radial-gradient(circle at 35% 30%, #ede9fe, #a78bfa 45%, #6d28d9)', boxShadow: '0 0 10px 2px rgba(167,139,250,0.75), 0 0 26px 6px rgba(124,58,237,0.4)' }
const dotRing = { position: 'absolute', width: 13, height: 13, borderRadius: '50%', border: '1.5px solid rgba(196,181,253,0.7)' }
const trail = (n) => ({ position: 'absolute', left: -(5 - n), top: -(5 - n), width: 10 - n * 2, height: 10 - n * 2, borderRadius: '50%', background: '#c4b5fd', filter: 'blur(1px)', pointerEvents: 'none' })

const cardBackdrop = { position: 'fixed', inset: 0, zIndex: 75, background: 'transparent' }
const cardWrap = { position: 'fixed', left: 0, right: 0, top: 'calc(env(safe-area-inset-top, 0px) + 66px)', display: 'flex', justifyContent: 'center', zIndex: 76, pointerEvents: 'none', padding: '0 12px' }
const card = { pointerEvents: 'auto', width: 'min(330px, 100%)', boxSizing: 'border-box', padding: 14, borderRadius: 20, color: '#ece8ff', background: 'rgba(21,13,38,0.88)', border: '1px solid rgba(167,139,250,0.3)', backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)', boxShadow: '0 18px 50px rgba(0,0,0,0.5), 0 0 0 1px rgba(124,58,237,0.12)' }
const cardRing = { display: 'inline-flex', padding: 2, borderRadius: '50%', background: 'linear-gradient(135deg,#8b5cf6,#6c63ff)', flexShrink: 0 }
const cardName = { fontSize: 14.5, fontWeight: 750, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }
const cardSub = { fontSize: 11.5, opacity: 0.55, marginTop: 1 }
const cardNote = { fontSize: 12, opacity: 0.7, lineHeight: 1.45, marginTop: 10 }
const cardPrimary = { flex: 1, padding: '10px 0', borderRadius: 12, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 750, fontSize: 13.5, color: '#fff', background: 'var(--brand-grad, linear-gradient(135deg,#8b5cf6,#6c63ff))' }
const cardGhost = { flex: 1, padding: '10px 0', borderRadius: 12, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 650, fontSize: 13.5, color: '#ece8ff', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)' }
