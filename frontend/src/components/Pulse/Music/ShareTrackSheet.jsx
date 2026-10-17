import React, { useState, useMemo, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence, useDragControls } from 'framer-motion'
import { IconX, IconSearch, IconCheck, IconSend, IconCopy, IconShare2, IconLoader2, IconUsers, IconDownload } from '../../Icons'
import { useIsMobile } from '../../../hooks/useIsMobile'
import { useDominantColor, rgba } from '../../../lib/music/extractColor'
import TrackArt from './TrackArt'

// Self-contained dark palette: the sheet never depends on the app theme's CSS variables.
const C = {
  bg: '#15121f', surface: 'rgba(255,255,255,0.06)', surface2: 'rgba(255,255,255,0.11)',
  line: 'rgba(255,255,255,0.10)', text: '#f6f4ff', muted: 'rgba(246,244,255,0.62)',
  accent: '#a78bfa', accent2: '#6c63ff', ok: '#4ade80', bad: '#f87171',
}
const MAX_RECIPIENTS = 5
const SUGGESTED = 5
const GRADS = [['#a78bfa', '#6c63ff'], ['#f472b6', '#db2777'], ['#34d399', '#059669'], ['#fbbf24', '#f97316'], ['#60a5fa', '#2563eb'], ['#fb7185', '#e11d48']]

const hash = (s = '') => { let h = 0; for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) | 0; return Math.abs(h) }

function Avatar({ name, url, size = 46, group }) {
  const [bad, setBad] = useState(false)
  const g = GRADS[hash(name) % GRADS.length]
  const initials = (name || '?').trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('') || '?'
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <div style={{
        width: size, height: size, borderRadius: '50%', overflow: 'hidden', color: '#fff', fontWeight: 800, fontSize: size * 0.36,
        background: `linear-gradient(135deg, ${g[0]}, ${g[1]})`, display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {url && !bad ? <img src={url} alt="" draggable={false} onError={() => setBad(true)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : initials}
      </div>
      {group && (
        <span style={{ position: 'absolute', right: -2, bottom: -2, width: 17, height: 17, borderRadius: '50%', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.muted }}>
          <IconUsers size={10} />
        </span>
      )}
    </div>
  )
}

function Check({ on, size = 22 }) {
  return (
    <span style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
      border: on ? '2px solid transparent' : `2px solid ${C.surface2}`,
      background: on ? `linear-gradient(135deg, ${C.accent}, ${C.accent2})` : 'transparent', transition: 'all .18s ease',
    }}>
      {on && <IconCheck size={13} style={{ color: '#fff' }} />}
    </span>
  )
}

function shareText(track) {
  const url = track.provider === 'youtube' && track.providerTrackId ? `https://music.youtube.com/watch?v=${track.providerTrackId}` : ''
  const line = `${track.title} — ${track.artist}`
  return { line, url, full: url ? `${line}\n${url}` : line }
}

export default function ShareTrackSheet({ track, conversations = [], onShare, onClose }) {
  const isMobile = useIsMobile()
  const dominant = useDominantColor(track?.artwork)
  const dragControls = useDragControls()
  const searchRef = useRef(null)
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState([])          // ordered ids
  const [status, setStatus] = useState({})              // id -> sending | sent | failed
  const [note, setNote] = useState('')
  const [phase, setPhase] = useState('idle')            // idle | sending | done
  const [copied, setCopied] = useState(false)
  const [limitHit, setLimitHit] = useState(false)

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    if (!isMobile) searchRef.current?.focus()
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, isMobile])

  const q = query.trim().toLowerCase()
  const byId = useMemo(() => Object.fromEntries(conversations.map((c) => [c.id, c])), [conversations])
  const suggested = q ? [] : conversations.slice(0, SUGGESTED)
  const rest = q
    ? conversations.filter((c) => (c.name || '').toLowerCase().includes(q))
    : conversations.slice(SUGGESTED)

  const toggle = (id) => {
    if (phase !== 'idle' || status[id] === 'sent') return
    setSelected((prev) => {
      if (prev.includes(id)) { setLimitHit(false); return prev.filter((x) => x !== id) }
      if (prev.length >= MAX_RECIPIENTS) { setLimitHit(true); return prev }
      setLimitHit(false)
      return [...prev, id]
    })
  }

  const send = async () => {
    if (!selected.length || phase !== 'idle') return
    setPhase('sending')
    const ids = [...selected]
    const okIds = []
    for (const id of ids) {
      setStatus((s) => ({ ...s, [id]: 'sending' }))
      try {
        await onShare(id, track, note.trim() || undefined)
        okIds.push(id)
        setStatus((s) => ({ ...s, [id]: 'sent' }))
      } catch {
        setStatus((s) => ({ ...s, [id]: 'failed' }))
      }
    }
    setSelected((prev) => prev.filter((id) => !okIds.includes(id)))   // failed ones stay selected for a retry
    setPhase(okIds.length === ids.length ? 'done' : 'idle')
  }

  const names = selected.map((id) => byId[id]?.name).filter(Boolean)
  const summary = names.length === 0 ? 'Choose who to send it to'
    : names.length <= 2 ? names.join(', ')
    : `${names.slice(0, 2).join(', ')} +${names.length - 2}`
  const sentCount = Object.values(status).filter((v) => v === 'sent').length

  const { line, url, full } = shareText(track)
  const copy = async () => {
    try { await navigator.clipboard.writeText(full); setCopied(true); setTimeout(() => setCopied(false), 1600) } catch { /* ignore */ }
  }
  const whatsapp = () => window.open(`https://wa.me/?text=${encodeURIComponent(full)}`, '_blank', 'noopener')
  const more = () => { if (navigator.share) navigator.share({ title: track.title, text: line, url: url || undefined }).catch(() => {}) }
  const canNativeShare = typeof navigator !== 'undefined' && !!navigator.share

  const Row = ({ c }) => {
    const on = selected.includes(c.id)
    const st = status[c.id]
    const full = !on && selected.length >= MAX_RECIPIENTS
    return (
      <button onClick={() => toggle(c.id)} disabled={st === 'sent' || phase === 'sending'}
        style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '9px 12px', borderRadius: 14, border: 'none', cursor: st === 'sent' ? 'default' : 'pointer', textAlign: 'left', fontFamily: 'inherit', opacity: full ? 0.45 : 1, background: on ? 'rgba(167,139,250,0.14)' : 'transparent', transition: 'background .15s' }}
        onMouseEnter={(e) => { if (!on) e.currentTarget.style.background = C.surface }} onMouseLeave={(e) => { if (!on) e.currentTarget.style.background = 'transparent' }}>
        <Avatar name={c.name} url={c.avatarUrl} size={44} group={c.isGroup} />
        <span style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: 700, color: C.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.name}</span>
        {st === 'sent' ? <span style={{ fontSize: 12, fontWeight: 800, color: C.ok, display: 'flex', alignItems: 'center', gap: 4 }}><IconCheck size={13} /> Sent</span>
          : st === 'sending' ? <IconLoader2 size={16} style={{ color: C.accent, animation: 'mcShareSpin 1s linear infinite' }} />
          : st === 'failed' ? <span style={{ fontSize: 12, fontWeight: 800, color: C.bad }}>Retry</span>
          : <Check on={on} />}
      </button>
    )
  }

  const quick = (icon, label, onClick, active) => (
    <button onClick={onClick} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'inherit', width: 64 }}>
      <span style={{ width: 46, height: 46, borderRadius: '50%', background: active ? 'rgba(74,222,128,0.18)' : C.surface2, color: active ? C.ok : C.text, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all .2s' }}>{icon}</span>
      <span style={{ fontSize: 10.5, fontWeight: 700, color: active ? C.ok : C.muted }}>{label}</span>
    </button>
  )

  const sheet = (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 800, background: 'rgba(5,4,12,0.62)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: isMobile ? 'flex-end' : 'center', justifyContent: 'center' }}
    >
      <style>{`@keyframes mcShareSpin{to{transform:rotate(360deg)}}`}</style>
      <motion.div
        onClick={(e) => e.stopPropagation()}
        role="dialog" aria-label="Share song"
        initial={isMobile ? { y: '100%' } : { opacity: 0, scale: 0.96, y: 12 }} animate={isMobile ? { y: 0 } : { opacity: 1, scale: 1, y: 0 }} exit={isMobile ? { y: '100%' } : { opacity: 0, scale: 0.97 }}
        transition={{ type: 'spring', stiffness: 380, damping: 34 }}
        drag={isMobile ? 'y' : false} dragControls={dragControls} dragListener={false} dragConstraints={{ top: 0, bottom: 0 }} dragElastic={{ top: 0, bottom: 0.5 }}
        onDragEnd={(_, info) => { if (info.offset.y > 120 || info.velocity.y > 600) onClose() }}
        style={{
          width: '100%', maxWidth: isMobile ? 560 : 480, height: isMobile ? 'min(88vh, 740px)' : 'min(82vh, 700px)', display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative',
          background: C.bg, color: C.text, border: `1px solid ${C.line}`, borderBottom: isMobile ? 'none' : `1px solid ${C.line}`,
          borderRadius: isMobile ? '24px 24px 0 0' : 24, boxShadow: '0 30px 80px rgba(0,0,0,0.55)', paddingBottom: isMobile ? 'env(safe-area-inset-bottom, 0px)' : 0,
        }}
      >
        {/* hero: artwork colour wash + track card (also the drag handle on mobile) */}
        <div onPointerDown={(e) => { if (isMobile) dragControls.start(e) }} style={{ position: 'relative', flexShrink: 0, touchAction: isMobile ? 'none' : 'auto', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(180deg, ${rgba(dominant, 0.55)} 0%, ${rgba(dominant, 0.12)} 70%, transparent 100%)` }} />
          {track.artwork && <div style={{ position: 'absolute', inset: 0, backgroundImage: `url(${track.artwork})`, backgroundSize: 'cover', backgroundPosition: 'center', filter: 'blur(40px) saturate(1.4)', opacity: 0.22, transform: 'scale(1.4)' }} />}
          {isMobile && <div style={{ position: 'relative', width: 38, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.3)', margin: '8px auto 0' }} />}
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 14, padding: '16px 16px 14px' }}>
            <div style={{ boxShadow: `0 12px 28px ${rgba(dominant, 0.5)}`, borderRadius: 14, flexShrink: 0 }}>
              <TrackArt src={track.artwork} size={64} radius={14} iconSize={22} />
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 0.7, textTransform: 'uppercase', color: C.muted }}>Share song</div>
              <div style={{ fontSize: 16, fontWeight: 800, letterSpacing: -0.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{track.title}</div>
              <div style={{ fontSize: 12.5, color: C.muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{track.artist}</div>
              {track.isDownloadable && (
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 5, fontSize: 10, fontWeight: 800, color: C.ok, background: 'rgba(74,222,128,0.12)', borderRadius: 999, padding: '3px 8px' }}>
                  <IconDownload size={10} /> Plays offline once heard
                </div>
              )}
            </div>
            <button onClick={onClose} onPointerDown={(e) => e.stopPropagation()} aria-label="Close"
              style={{ alignSelf: 'flex-start', width: 32, height: 32, borderRadius: '50%', border: 'none', background: 'rgba(255,255,255,0.12)', color: C.text, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <IconX size={15} />
            </button>
          </div>
        </div>

        {/* search */}
        <div style={{ padding: '4px 16px 8px', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: C.surface, border: `1px solid ${C.line}`, borderRadius: 14, padding: '10px 12px' }}>
            <IconSearch size={15} style={{ color: C.muted }} />
            <input ref={searchRef} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search people or groups"
              style={{ flex: 1, minWidth: 0, background: 'transparent', border: 'none', outline: 'none', color: C.text, fontSize: 14, fontFamily: 'inherit' }} />
            {query && <button onClick={() => setQuery('')} aria-label="Clear search" style={{ background: 'transparent', border: 'none', color: C.muted, cursor: 'pointer', display: 'flex', padding: 2 }}><IconX size={14} /></button>}
          </div>
        </div>

        {/* scrollable body */}
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '4px 8px 12px' }}>
          {!q && (
            <>
              <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 0.7, textTransform: 'uppercase', color: C.muted, padding: '8px 12px 6px' }}>Share outside Mattchat</div>
              <div style={{ display: 'flex', gap: 6, padding: '0 8px 10px' }}>
                {quick(copied ? <IconCheck size={19} /> : <IconCopy size={19} />, copied ? 'Copied' : 'Copy', copy, copied)}
                {quick(<IconSend size={19} />, 'WhatsApp', whatsapp)}
                {canNativeShare && quick(<IconShare2 size={19} />, 'More', more)}
              </div>
            </>
          )}

          {conversations.length === 0 ? (
            <div style={{ textAlign: 'center', color: C.muted, fontSize: 13, padding: '32px 16px' }}>You have no chats yet. Start a conversation, then share songs here.</div>
          ) : (
            <>
              {suggested.length > 0 && (
                <>
                  <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 0.7, textTransform: 'uppercase', color: C.muted, padding: '8px 12px 8px' }}>Suggested</div>
                  <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(SUGGESTED, suggested.length)}, 1fr)`, gap: 4, padding: '0 4px 8px' }}>
                    {suggested.map((c) => {
                      const on = selected.includes(c.id)
                      const st = status[c.id]
                      return (
                        <motion.button key={c.id} whileTap={{ scale: 0.94 }} onClick={() => toggle(c.id)} disabled={st === 'sent' || phase === 'sending'}
                          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, background: 'transparent', border: 'none', cursor: 'pointer', padding: '6px 2px', fontFamily: 'inherit', minWidth: 0 }}>
                          <span style={{ position: 'relative' }}>
                            <span style={{ display: 'block', borderRadius: '50%', boxShadow: on ? `0 0 0 3px ${C.bg}, 0 0 0 5px ${C.accent}` : 'none', transition: 'box-shadow .18s' }}>
                              <Avatar name={c.name} url={c.avatarUrl} size={52} group={c.isGroup} />
                            </span>
                            <AnimatePresence>
                              {(on || st === 'sent') && (
                                <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} transition={{ type: 'spring', stiffness: 500, damping: 22 }}
                                  style={{ position: 'absolute', right: -4, top: -4, width: 20, height: 20, borderRadius: '50%', background: st === 'sent' ? C.ok : `linear-gradient(135deg, ${C.accent}, ${C.accent2})`, color: st === 'sent' ? '#06240f' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', border: `2px solid ${C.bg}` }}>
                                  <IconCheck size={11} />
                                </motion.span>
                              )}
                            </AnimatePresence>
                          </span>
                          <span style={{ width: '100%', fontSize: 11, fontWeight: 700, color: on ? C.text : C.muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textAlign: 'center' }}>{(c.name || '').split(' ')[0]}</span>
                        </motion.button>
                      )
                    })}
                  </div>
                </>
              )}

              {rest.length > 0 && (
                <>
                  <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 0.7, textTransform: 'uppercase', color: C.muted, padding: '8px 12px 4px' }}>{q ? 'Results' : 'All chats'}</div>
                  {rest.map((c) => <Row key={c.id} c={c} />)}
                </>
              )}
              {q && rest.length === 0 && (
                <div style={{ textAlign: 'center', color: C.muted, fontSize: 13, padding: '28px 16px' }}>No chats match “{query}”.</div>
              )}
            </>
          )}
        </div>

        {/* footer: optional note + one big send button */}
        <div style={{ flexShrink: 0, borderTop: `1px solid ${C.line}`, background: 'rgba(255,255,255,0.03)', padding: '12px 16px 14px' }}>
          <AnimatePresence initial={false}>
            {selected.length > 0 && phase === 'idle' && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ overflow: 'hidden' }}>
                <input value={note} onChange={(e) => setNote(e.target.value.slice(0, 140))} placeholder="Add a message (optional)"
                  style={{ width: '100%', boxSizing: 'border-box', marginBottom: 10, background: C.surface, border: `1px solid ${C.line}`, borderRadius: 12, padding: '10px 12px', color: C.text, fontSize: 13.5, outline: 'none', fontFamily: 'inherit' }} />
              </motion.div>
            )}
          </AnimatePresence>

          {limitHit && <div style={{ fontSize: 11.5, color: '#fbbf24', marginBottom: 8, fontWeight: 600 }}>You can send to up to {MAX_RECIPIENTS} chats at once.</div>}

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 0.6, textTransform: 'uppercase', color: C.muted }}>
                {phase === 'done' ? 'Delivered' : selected.length ? `${selected.length} selected` : 'Send to'}
              </div>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: phase === 'done' ? C.ok : C.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {phase === 'done' ? `Sent to ${sentCount} ${sentCount === 1 ? 'chat' : 'chats'}` : summary}
              </div>
            </div>
            {phase === 'done' ? (
              <motion.button whileTap={{ scale: 0.96 }} onClick={onClose}
                style={{ height: 46, padding: '0 26px', borderRadius: 999, border: 'none', cursor: 'pointer', fontWeight: 800, fontSize: 14, color: '#06240f', background: C.ok, fontFamily: 'inherit' }}>
                Done
              </motion.button>
            ) : (
              <motion.button whileTap={{ scale: 0.96 }} onClick={send} disabled={!selected.length || phase === 'sending'}
                style={{ height: 46, minWidth: 124, padding: '0 22px', borderRadius: 999, border: 'none', cursor: selected.length ? 'pointer' : 'not-allowed', fontWeight: 800, fontSize: 14, color: '#fff', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  background: selected.length ? `linear-gradient(135deg, ${C.accent}, ${C.accent2})` : C.surface2, opacity: selected.length ? 1 : 0.55, boxShadow: selected.length ? '0 10px 26px rgba(108,99,255,0.45)' : 'none' }}>
                {phase === 'sending' ? <IconLoader2 size={17} style={{ animation: 'mcShareSpin 1s linear infinite' }} /> : <IconSend size={16} />}
                {phase === 'sending' ? 'Sending…' : selected.length ? `Send${selected.length > 1 ? ` · ${selected.length}` : ''}` : 'Send'}
              </motion.button>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  )

  return createPortal(sheet, document.body)
}
