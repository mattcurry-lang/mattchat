import React, { useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import Avatar from './Avatar'
import {
  FOCUS_MODES, DURATIONS, modeById, normalizeFocus, activeMode, allowedOf,
  activate, deactivate, toggleAllowed, setAllowed, describeFocus, allowedSummary,
} from '../lib/focus'

/*
 * Focus modes screen (opens from Profile > Notifications and focus > Focus modes).
 *
 *   <FocusSheet focus={vals.focus} contacts={[{ id, name, avatarUrl }]} onChange={(next) => save('focus', next)} />
 *
 * Home: the three modes, each with a switch, and a banner while one is on.
 * Edit: choose who can still reach you, pick how long, turn it on.
 */

function useNow(ms = 30000) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), ms); return () => clearInterval(id) }, [ms])
  return now
}

const gradient = (m) => `linear-gradient(135deg, ${m.colors[0]}, ${m.colors[1]})`

function Check({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M5 12.5l4.5 4.5L19 7.5" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function Switch({ on }) {
  return (
    <span style={{ ...swTrack, background: on ? 'var(--brand-grad, linear-gradient(135deg,#667eea,#764ba2))' : 'var(--chip-bg, rgba(255,255,255,0.08))', border: on ? '1px solid transparent' : '1px solid var(--dark-border, rgba(255,255,255,0.14))' }} aria-hidden="true">
      <i style={{ ...swThumb, transform: on ? 'translateX(16px)' : 'translateX(0)' }} />
    </span>
  )
}

export default function FocusSheet({ focus: rawFocus, contacts = [], onChange }) {
  const reduce = useReducedMotion()
  const now = useNow()
  const focus = useMemo(() => normalizeFocus(rawFocus), [rawFocus])
  const activeId = activeMode(focus, now)
  const status = describeFocus(focus, now)
  const [editing, setEditing] = useState(null) // mode id | null
  const [durationId, setDurationId] = useState('off')
  const [query, setQuery] = useState('')

  const turnOn = (id, durationMs = null) => onChange(activate(focus, id, durationMs, Date.now()))
  const turnOff = () => onChange(deactivate(focus))

  const move = reduce ? { duration: 0 } : { duration: 0.18 }
  const slide = (dir) => (reduce ? {} : { x: dir * 18 })

  return (
    <div>
      <AnimatePresence mode="wait" initial={false}>
        {editing === null ? (
          <motion.div key="home" initial={{ opacity: 0, ...slide(-1) }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, ...slide(-1) }} transition={move}>
            {activeId && (
              <div style={bannerStyle(modeById(activeId))} role="status">
                <span style={{ fontSize: 30, lineHeight: 1 }} aria-hidden="true">{modeById(activeId).emoji}</span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 15, fontWeight: 800 }}>{status.title}</span>
                  <span style={{ display: 'block', fontSize: 12.5, opacity: 0.9, marginTop: 1 }}>{status.detail}</span>
                </span>
                <button type="button" onClick={turnOff} style={bannerBtn}>Turn off</button>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {FOCUS_MODES.map((m) => {
                const isOn = activeId === m.id
                return (
                  <div key={m.id} style={cardStyle(isOn)}>
                    <button type="button" className="pm-btn" onClick={() => { setEditing(m.id); setQuery(''); setDurationId('off') }} aria-label={`${m.name} settings`} style={cardMain}>
                      <span style={{ ...emojiTile, background: gradient(m) }} aria-hidden="true">{m.emoji}</span>
                      <span style={{ minWidth: 0 }}>
                        <span style={{ display: 'block', fontSize: 14.5, fontWeight: 750, color: 'var(--dark-text)' }}>{m.name}</span>
                        <span style={{ display: 'block', fontSize: 12, color: 'var(--dark-text-3)', marginTop: 1 }}>{allowedSummary(focus, m.id)}</span>
                        {isOn && <span style={{ display: 'block', fontSize: 11.5, fontWeight: 700, color: 'var(--brand-light, #a78bfa)', marginTop: 2 }}>On, {status.detail}</span>}
                      </span>
                    </button>
                    <button type="button" className="pm-btn" role="switch" aria-checked={isOn} aria-label={`${m.name} focus`} onClick={() => (isOn ? turnOff() : turnOn(m.id))} style={switchBtn}>
                      <Switch on={isOn} />
                    </button>
                  </div>
                )
              })}
            </div>

            <p style={noteStyle}>
              While a mode is on, message alerts from anyone not on its list stay quiet. People on the list still get through, even during quiet hours. Calls still ring.
            </p>
          </motion.div>
        ) : (
          <Editor
            key={`edit-${editing}`}
            mode={modeById(editing)} focus={focus} contacts={contacts} isOn={activeId === editing} status={status}
            durationId={durationId} setDurationId={setDurationId} query={query} setQuery={setQuery}
            onBack={() => setEditing(null)} onChange={onChange}
            onTurnOn={() => { turnOn(editing, DURATIONS.find((d) => d.id === durationId)?.ms ?? null); setEditing(null) }}
            onTurnOff={() => { turnOff(); setEditing(null) }}
            move={move} slide={slide}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

function Editor({ mode, focus, contacts, isOn, status, durationId, setDurationId, query, setQuery, onBack, onChange, onTurnOn, onTurnOff, move, slide }) {
  const allowed = allowedOf(focus, mode.id)
  const q = query.trim().toLowerCase()
  const shown = contacts.filter((c) => !q || (c.name || '').toLowerCase().includes(q))
  const selectedVisible = contacts.filter((c) => allowed.includes(c.id)).length

  return (
    <motion.div initial={{ opacity: 0, ...slide(1) }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, ...slide(1) }} transition={move}>
      <button type="button" className="pm-btn" onClick={onBack} style={backBtn} aria-label="Back to focus modes">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M15 6l-6 6 6 6" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
        Focus modes
      </button>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '6px 0 4px' }}>
        <span style={{ ...emojiTile, width: 52, height: 52, fontSize: 26, background: gradient(mode) }} aria-hidden="true">{mode.emoji}</span>
        <div>
          <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--dark-text)' }}>{mode.name}</div>
          <div style={{ fontSize: 12.5, color: 'var(--dark-text-3)' }}>{isOn ? `On, ${status.detail}` : mode.blurb}</div>
        </div>
      </div>

      {!isOn && (
        <>
          <div style={labelStyle}>Turn on for</div>
          <div style={segStyle} role="radiogroup" aria-label="How long">
            {DURATIONS.map((d) => (
              <button key={d.id} type="button" className="pm-btn" role="radio" aria-checked={durationId === d.id} onClick={() => setDurationId(d.id)}
                style={{ ...segBtn, ...(durationId === d.id ? segBtnOn : null) }}>
                {d.id === 'off' ? 'Until off' : d.label}
              </button>
            ))}
          </div>
        </>
      )}

      <div style={{ ...labelStyle, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span>People who can still reach you</span>
        <span style={{ fontWeight: 600, color: 'var(--dark-text-3)' }}>{selectedVisible} allowed</span>
      </div>

      {contacts.length === 0 ? (
        <div style={emptyStyle}>Start a chat first. The people you message will show up here.</div>
      ) : (
        <>
          <input
            value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search people" aria-label="Search people"
            className="pm-field" style={searchStyle}
          />
          <div style={{ display: 'flex', gap: 8, margin: '8px 0' }}>
            <button type="button" className="pm-btn" style={chipBtn} onClick={() => onChange(setAllowed(focus, mode.id, [...allowed, ...shown.map((c) => c.id)]))}>
              {q ? 'Select these' : 'Select all'}
            </button>
            <button type="button" className="pm-btn" style={chipBtn} onClick={() => onChange(setAllowed(focus, mode.id, []))} disabled={allowed.length === 0}>Clear</button>
          </div>
          <div style={listStyle} role="group" aria-label="Allowed people">
            {shown.length === 0 && <div style={{ ...emptyStyle, padding: '18px 0' }}>No one matches "{query}".</div>}
            {shown.map((c, i) => {
              const sel = allowed.includes(c.id)
              return (
                <button key={c.id} type="button" className="pm-btn pm-row" role="checkbox" aria-checked={sel}
                  onClick={() => onChange(toggleAllowed(focus, mode.id, c.id))}
                  style={{ ...personRow, borderBottom: i < shown.length - 1 ? '1px solid var(--dark-border)' : 'none' }}>
                  <Avatar name={c.name} photoUrl={c.avatarUrl} size={38} />
                  <span style={{ flex: 1, minWidth: 0, textAlign: 'left', fontSize: 14, fontWeight: 650, color: 'var(--dark-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</span>
                  <span style={{ ...checkCircle, ...(sel ? checkOn : null) }} aria-hidden="true">{sel && <Check />}</span>
                </button>
              )
            })}
          </div>
        </>
      )}

      <div style={stickyBar}>
        {isOn
          ? <button type="button" className="pm-btn" onClick={onTurnOff} style={{ ...mainBtn, background: 'rgba(239,68,68,0.14)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)' }}>Turn off {mode.name}</button>
          : <button type="button" className="pm-btn" onClick={onTurnOn} style={{ ...mainBtn, background: gradient(mode), color: '#fff' }}>Turn on {mode.name}</button>}
      </div>
    </motion.div>
  )
}

// ---- styles ----
const swTrack = { position: 'relative', width: 40, height: 24, borderRadius: 999, display: 'block', boxSizing: 'border-box', flexShrink: 0 }
const swThumb = { position: 'absolute', top: 2, left: 2, width: 18, height: 18, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.35)', transition: 'transform .18s ease' }

const bannerStyle = (m) => ({ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 14px', marginBottom: 12, borderRadius: 18, color: '#fff', background: gradient(m), boxShadow: '0 10px 26px rgba(0,0,0,0.3)' })
const bannerBtn = { flexShrink: 0, border: 'none', background: 'rgba(255,255,255,0.22)', color: '#fff', fontWeight: 750, fontSize: 12.5, padding: '8px 14px', borderRadius: 999, cursor: 'pointer', fontFamily: 'inherit' }

const cardStyle = (on) => ({ display: 'flex', alignItems: 'center', gap: 6, borderRadius: 16, background: 'var(--dark-card)', border: on ? '1px solid rgba(167,139,250,0.55)' : '1px solid var(--dark-border)', boxShadow: on ? '0 0 0 3px rgba(167,139,250,0.12)' : 'none' })
const cardMain = { flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 12, padding: '12px 4px 12px 12px', border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }
const switchBtn = { border: 'none', background: 'none', padding: '14px 14px 14px 6px', cursor: 'pointer', display: 'flex' }
const emojiTile = { width: 44, height: 44, borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0, boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.25)' }
const noteStyle = { fontSize: 12, lineHeight: 1.5, color: 'var(--dark-text-3)', margin: '14px 4px 4px' }

const backBtn = { display: 'inline-flex', alignItems: 'center', gap: 4, border: 'none', background: 'none', color: 'var(--brand-light, #a78bfa)', fontSize: 13.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', padding: '4px 4px 4px 0' }
const labelStyle = { fontSize: 12.5, fontWeight: 700, color: 'var(--dark-text-2)', margin: '18px 2px 8px' }
const segStyle = { display: 'flex', gap: 4, padding: 4, borderRadius: 12, background: 'var(--chip-bg)', border: '1px solid var(--dark-border)' }
const segBtn = { flex: 1, padding: '9px 2px', borderRadius: 9, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: 700, background: 'transparent', color: 'var(--dark-text-2)', whiteSpace: 'nowrap' }
const segBtnOn = { background: 'var(--brand-grad, linear-gradient(135deg,#667eea,#764ba2))', color: '#fff' }
const searchStyle = { width: '100%', boxSizing: 'border-box', padding: '11px 12px', borderRadius: 12, border: '1px solid var(--dark-border)', background: 'var(--dark-card)', color: 'var(--dark-text)', fontSize: 14, outline: 'none', fontFamily: 'inherit' }
const chipBtn = { padding: '6px 12px', borderRadius: 999, border: '1px solid var(--dark-border)', background: 'var(--dark-card)', color: 'var(--dark-text-2)', fontSize: 12, fontWeight: 650, cursor: 'pointer', fontFamily: 'inherit' }
const listStyle = { background: 'var(--dark-card)', border: '1px solid var(--dark-border)', borderRadius: 16, overflow: 'hidden' }
const personRow = { display: 'flex', alignItems: 'center', gap: 12, width: '100%', boxSizing: 'border-box', padding: '10px 14px', border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: 'inherit' }
const checkCircle = { width: 24, height: 24, borderRadius: '50%', border: '2px solid var(--dark-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', flexShrink: 0, boxSizing: 'border-box' }
const checkOn = { background: 'var(--brand-grad, linear-gradient(135deg,#667eea,#764ba2))', border: '2px solid transparent' }
const emptyStyle = { textAlign: 'center', color: 'var(--dark-text-3)', fontSize: 13, padding: '26px 8px', background: 'var(--dark-card)', border: '1px dashed var(--dark-border)', borderRadius: 14 }
const stickyBar = { position: 'sticky', bottom: -1, marginTop: 16, padding: '12px 0 2px', background: 'linear-gradient(180deg, transparent, var(--dark-card-2, var(--dark-card)) 35%)' }
const mainBtn = { width: '100%', padding: '14px 0', borderRadius: 14, border: 'none', fontSize: 14.5, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }
