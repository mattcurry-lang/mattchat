// src/components/Pulse/AskCurry.jsx
//
// Curry's chat surface. Two modes:
//   - Chat: refined bubbles, source chips, action cards (unchanged
//     logic from Phase 2), plus a lightweight client-side "streaming"
//     reveal on assistant replies for a more alive feel — the backend
//     still returns one full response, this just reveals it
//     progressively rather than dumping it in all at once. True
//     token-by-token streaming would need the edge function to speak
//     SSE, which is a bigger backend change, not a UI one.
//   - Voice: push-to-talk. Tap the orb to listen, tap again to send;
//     the orb's color and pulse reflect real mic amplitude while
//     listening, and Curry speaks its reply aloud via the browser's
//     speech synthesis. Falls back to chat-only if the browser doesn't
//     support microphone access — see useCurryVoice's `supported` flag).

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { DekutIcon, ICON_GRADIENTS } from './dekutIcons'
import CurryOrbGraphic from './CurryOrbGraphic'
import { useCurryChat } from '../../hooks/useCurryChat'
import { useCurryVoice } from '../../hooks/useCurryVoice'
import { DEKUT_CATEGORIES, getServiceById } from '../../data/dekutServices'
import { useDekutUsage } from '../../hooks/useDekutUsage'
import { openDekutService } from '../../utils/dekutOpenService'

const TEXT_PRIMARY = '#f5f5fa'
const TEXT_SECONDARY = 'rgba(245,245,250,0.6)'
const BORDER = 'rgba(245,245,250,0.16)'
const SURFACE = 'rgba(245,245,250,0.06)'

// Empty-state quick actions — icon + color per action, not plain text
// pills, so the hero reads as designed rather than a generic FAQ list.
const QUICK_ACTIONS = [
  { text: "What's on the menu today?", icon: 'utensils', color: '#fb923c' },
  { text: "Where is RC18?", icon: 'file', color: '#38bdf8' },
  { text: "How do I register my units?", icon: 'cap', color: '#a78bfa' },
  { text: "Where is the library?", icon: 'book', color: '#34d399' },
  { text: "I'm a first-year student", icon: 'star', color: '#f59e0b' },
]

const ACTION_SERVICE_ID = {
  OPEN_STUDENT_PORTAL: 'student-portal',
  OPEN_ELEARNING: 'elearning',
  OPEN_LIBRARY: 'library',
  OPEN_CATERING: 'catering',
  OPEN_SUPPORT: 'contacts',
  SHOW_ROUTE: 'room-finder',
  SHOW_LOCATION: 'room-finder',
  SHOW_CONTACT: 'contacts',
}

const ACTION_LABEL = {
  OPEN_STUDENT_PORTAL: 'Open Student Portal',
  OPEN_ELEARNING: 'Open eLearning',
  OPEN_LIBRARY: 'Open Library',
  OPEN_CATERING: 'Open Catering',
  OPEN_SUPPORT: 'Get Support',
  SHOW_ROUTE: 'Show on Campus Map',
  SHOW_LOCATION: 'Show on Campus Map',
  SHOW_CONTACT: 'View Contact Details',
}

// Reveals text progressively on mount rather than all at once. Caps
// total duration so long replies don't feel sluggish.
function StreamingText({ text }) {
  const [count, setCount] = useState(0)
  useEffect(() => {
    if (!text) return
    const totalMs = Math.min(900, Math.max(150, text.length * 8))
    const stepMs = Math.max(8, totalMs / text.length)
    const id = setInterval(() => {
      setCount((c) => {
        if (c >= text.length) { clearInterval(id); return c }
        return c + 1
      })
    }, stepMs)
    return () => clearInterval(id)
     
  }, [])
  return <>{text.slice(0, count)}</>
}

function SourceChips({ sources }) {
  if (!sources || sources.length === 0) return null
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
      {sources.map((s, i) => (
        <span key={i} title={s.authority || undefined} style={{
          fontSize: 10.5, fontWeight: 600, color: TEXT_SECONDARY,
          border: `1px solid ${BORDER}`, borderRadius: 999, padding: '3px 9px',
        }}>
          {s.source || s.title}
        </span>
      ))}
    </div>
  )
}

const ACCENT = 'linear-gradient(135deg,#a78bfa,#6c63ff)'
const CARD_STYLE = {
  marginTop: 12, width: '100%', border: `1px solid ${BORDER}`, borderRadius: 16,
  overflow: 'hidden', background: 'rgba(15,15,26,0.55)',
}
const fieldStyle = {
  width: '100%', boxSizing: 'border-box', border: `1px solid ${BORDER}`, borderRadius: 10,
  padding: '11px 12px', fontSize: 13.5, background: SURFACE, color: TEXT_PRIMARY, fontFamily: 'inherit', outline: 'none',
}

function formatTime(iso) {
  if (!iso) return null
  try {
    return new Date(iso).toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Nairobi' })
  } catch { return null }
}

function maskPhone(phone) {
  if (!phone) return ''
  const p = String(phone)
  const local = p.startsWith('254') ? `0${p.slice(3)}` : p
  return local.length <= 6 ? local : `${local.slice(0, 4)}•••${local.slice(-3)}`
}

function OrderLines({ items, total }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {items.map((item, i) => (
        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 13, color: TEXT_PRIMARY }}>
          <span>{item.quantity} × {item.name}</span>
          <span style={{ color: TEXT_SECONDARY, whiteSpace: 'nowrap' }}>KSh {item.unit_price * item.quantity}</span>
        </div>
      ))}
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, fontWeight: 800, color: TEXT_PRIMARY, paddingTop: 10, borderTop: `1px solid ${BORDER}` }}>
        <span>Total</span><span>KSh {total}</span>
      </div>
    </div>
  )
}

// Review step: everything the student needs to say yes, nothing they don't.
function CateringOrderCard({ action, message, onConfirm, onChange }) {
  const { mess_name, items, total, customer_name, customer_phone } = action.args

  if (message.confirmed) {
    return <div style={{ marginTop: 8, fontSize: 11.5, color: TEXT_SECONDARY }}>Confirmed</div>
  }

  return (
    <div style={CARD_STYLE}>
      <div style={{ padding: '14px 16px 12px', borderBottom: `1px solid ${BORDER}` }}>
        <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.08em', color: TEXT_SECONDARY, textTransform: 'uppercase' }}>Your order</div>
        <div style={{ fontSize: 15, fontWeight: 800, color: TEXT_PRIMARY, marginTop: 3 }}>{mess_name}</div>
      </div>
      <div style={{ padding: '14px 16px' }}>
        <OrderLines items={items} total={total} />
        <div style={{ marginTop: 14, padding: '10px 12px', borderRadius: 10, background: SURFACE, fontSize: 12, color: TEXT_SECONDARY, lineHeight: 1.5 }}>
          Payment prompt goes to <span style={{ color: TEXT_PRIMARY, fontWeight: 700 }}>{maskPhone(customer_phone)}</span> · {customer_name}
        </div>
      </div>
      <div style={{ padding: '0 16px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <button onClick={() => onConfirm(message.id, action)} style={{
          width: '100%', fontSize: 14, fontWeight: 800, color: '#fff', fontFamily: 'inherit',
          border: 'none', borderRadius: 12, padding: '13px 0', cursor: 'pointer', background: ACCENT,
        }}>
          Place order · KSh {total}
        </button>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => onChange({ intent: 'catering_menu', mess: mess_name }, 'Change my order', message.id)} style={{
            flex: 1, fontSize: 12.5, fontWeight: 700, color: TEXT_PRIMARY, fontFamily: 'inherit',
            border: `1px solid ${BORDER}`, borderRadius: 10, padding: '10px 0', cursor: 'pointer', background: 'none',
          }}>
            Change items
          </button>
          <button onClick={() => onConfirm(message.id, null)} style={{
            flex: 1, fontSize: 12.5, fontWeight: 700, color: TEXT_SECONDARY, fontFamily: 'inherit',
            border: `1px solid ${BORDER}`, borderRadius: 10, padding: '10px 0', cursor: 'pointer', background: 'none',
          }}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

// SHOW_MENU: live menu with a tab per mess, real stock, search, and a
// single primary action. Prices and quantities come from the backend.
function CateringMenuCard({ action, message, onOrder }) {
  const messes = action.messes || []
  const [messId, setMessId] = useState((messes.find((m) => m.open) || messes[0])?.id ?? null)
  const [cart, setCart] = useState({}) // item_id -> quantity (ids are unique across messes)
  const [query, setQuery] = useState('')

  if (message.confirmed) return null

  const mess = messes.find((m) => m.id === messId) || messes[0]
  if (!mess) return null

  const setQty = (itemId, qty) => setCart((c) => {
    const next = { ...c }
    if (qty <= 0) delete next[itemId]
    else next[itemId] = qty
    return next
  })

  const q = query.trim().toLowerCase()
  const visible = mess.items.filter((i) => !q || i.name.toLowerCase().includes(q))
  const cartItems = mess.items.filter((i) => cart[i.id] > 0).map((i) => ({ ...i, quantity: cart[i.id] }))
  const count = cartItems.reduce((s, i) => s + i.quantity, 0)
  const total = cartItems.reduce((s, i) => s + i.unit_price * i.quantity, 0)
  const countIn = (m) => m.items.reduce((s, i) => s + (cart[i.id] || 0), 0)
  const asOf = formatTime(action.as_of)

  const handleOrder = () => {
    if (cartItems.length === 0) return
    onOrder(
      { intent: 'catering_draft', draft: { mess_id: mess.id, items: cartItems.map((i) => ({ item_id: i.id, quantity: i.quantity })) } },
      `${cartItems.map((i) => `${i.quantity} × ${i.name}`).join(', ')} from ${mess.name}`,
      message.id
    )
  }

  return (
    <div style={CARD_STYLE}>
      {/* Status line */}
      <div style={{ padding: '12px 16px 4px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: TEXT_PRIMARY }}>Today's menu</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: TEXT_SECONDARY }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: action.live ? '#34d399' : '#f59e0b' }} />
          {action.live ? (asOf ? `Live · ${asOf}` : 'Live') : (asOf ? `Last updated ${asOf}` : 'May be out of date')}
        </div>
      </div>

      {/* One tab per mess, always shown */}
      {messes.length > 1 && (
        <div style={{ display: 'flex', gap: 8, padding: '10px 16px 12px', overflowX: 'auto' }}>
          {messes.map((m) => {
            const active = m.id === mess.id
            const inCart = countIn(m)
            return (
              <button key={m.id} onClick={() => { setMessId(m.id); setQuery('') }} style={{
                flexShrink: 0, textAlign: 'left', fontFamily: 'inherit', cursor: 'pointer',
                padding: '8px 12px', borderRadius: 12, minWidth: 96,
                border: `1px solid ${active ? '#a78bfa' : BORDER}`,
                background: active ? 'rgba(167,139,250,0.14)' : SURFACE,
                opacity: m.open || active ? 1 : 0.65,
              }}>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: TEXT_PRIMARY, display: 'flex', alignItems: 'center', gap: 6 }}>
                  {m.name}
                  {inCart > 0 && <span style={{ fontSize: 10, background: '#a78bfa', color: '#fff', borderRadius: 999, padding: '1px 6px' }}>{inCart}</span>}
                </div>
                <div style={{ fontSize: 10.5, marginTop: 2, color: m.open ? '#6ee7b7' : TEXT_SECONDARY }}>
                  {m.open ? `${m.available_count} available` : 'Nothing on now'}
                </div>
              </button>
            )
          })}
        </div>
      )}

      {mess.items.length > 8 && (
        <div style={{ padding: '0 16px 10px' }}>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={`Search ${mess.name}`} style={fieldStyle} />
        </div>
      )}

      {/* Items */}
      <div style={{ maxHeight: 340, overflowY: 'auto', borderTop: `1px solid ${BORDER}` }}>
        {visible.length === 0 && (
          <div style={{ padding: '28px 16px', textAlign: 'center', fontSize: 12.5, color: TEXT_SECONDARY, lineHeight: 1.5 }}>
            {mess.items.length === 0
              ? `Nothing is being served at ${mess.name} right now. Check back a little later.`
              : `No items match "${query}".`}
          </div>
        )}
        {visible.map((item) => {
          const qty = cart[item.id] || 0
          const left = item.available_quantity
          const soldOut = !item.is_available || left <= 0
          const maxQty = Math.min(20, left)
          return (
            <div key={item.id} style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
              borderBottom: `1px solid ${BORDER}`, opacity: soldOut ? 0.5 : 1,
            }}>
              <div style={{ width: 52, height: 52, borderRadius: 12, flexShrink: 0, overflow: 'hidden', background: SURFACE, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 800, color: TEXT_SECONDARY }}>
                {item.image_url
                  ? <img src={item.image_url} alt="" loading="lazy" onError={(e) => { e.currentTarget.style.display = 'none' }} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : item.name.charAt(0)}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: TEXT_PRIMARY, lineHeight: 1.3 }}>{item.name}</div>
                <div style={{ fontSize: 12, marginTop: 3, color: TEXT_SECONDARY }}>
                  <span style={{ color: TEXT_PRIMARY, fontWeight: 700 }}>KSh {item.unit_price}</span>
                  {!soldOut && <span style={{ color: left <= 5 ? '#fbbf24' : TEXT_SECONDARY }}> · {left} left</span>}
                </div>
              </div>
              {soldOut ? (
                <span style={{ fontSize: 11.5, fontWeight: 700, color: TEXT_SECONDARY }}>Sold out</span>
              ) : qty === 0 ? (
                <button onClick={() => setQty(item.id, 1)} style={{
                  fontSize: 12.5, fontWeight: 700, color: '#c4b5fd', fontFamily: 'inherit', cursor: 'pointer',
                  border: '1px solid rgba(167,139,250,0.5)', background: 'rgba(167,139,250,0.1)', borderRadius: 999, padding: '7px 16px',
                }}>Add</button>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <button onClick={() => setQty(item.id, qty - 1)} aria-label={`Remove one ${item.name}`} style={{
                    width: 30, height: 30, borderRadius: 999, border: `1px solid ${BORDER}`, background: 'none', color: TEXT_PRIMARY, cursor: 'pointer', fontSize: 16, fontFamily: 'inherit',
                  }}>−</button>
                  <span style={{ fontSize: 13.5, fontWeight: 800, color: TEXT_PRIMARY, minWidth: 16, textAlign: 'center' }}>{qty}</span>
                  <button onClick={() => setQty(item.id, Math.min(maxQty, qty + 1))} disabled={qty >= maxQty} aria-label={`Add one ${item.name}`} style={{
                    width: 30, height: 30, borderRadius: 999, border: 'none', background: ACCENT, color: '#fff', fontSize: 16, fontFamily: 'inherit',
                    cursor: qty >= maxQty ? 'default' : 'pointer', opacity: qty >= maxQty ? 0.4 : 1,
                  }}>+</button>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Footer */}
      <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, borderTop: `1px solid ${BORDER}` }}>
        <div style={{ flex: 1, fontSize: 13, color: TEXT_PRIMARY }}>
          {count > 0
            ? <><span style={{ fontWeight: 800 }}>{count} item{count > 1 ? 's' : ''}</span><span style={{ color: TEXT_SECONDARY }}> · KSh {total}</span></>
            : <span style={{ color: TEXT_SECONDARY }}>Tap Add to start your order</span>}
        </div>
        <button onClick={handleOrder} disabled={count === 0} style={{
          fontSize: 13, fontWeight: 800, color: '#fff', fontFamily: 'inherit', border: 'none', borderRadius: 999,
          padding: '10px 18px', background: ACCENT,
          cursor: count === 0 ? 'default' : 'pointer', opacity: count === 0 ? 0.4 : 1,
        }}>
          Review order
        </button>
      </div>
    </div>
  )
}

// First-order name/phone capture, with the order summary in view so the
// student knows what they're about to pay for.
function CateringDetailsForm({ action, message, onSubmit }) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')

  if (message.confirmed) return null

  const draft = action.draft
  const handleSubmit = (e) => {
    e.preventDefault()
    if (!name.trim() || !phone.trim()) return
    onSubmit(
      { intent: 'save_contact', customer_name: name.trim(), customer_phone: phone.trim(), draft },
      `${name.trim()}, ${phone.trim()}`,
      message.id
    )
  }

  return (
    <form onSubmit={handleSubmit} style={{ ...CARD_STYLE, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
      {draft?.items && (
        <div style={{ paddingBottom: 12, borderBottom: `1px solid ${BORDER}` }}>
          <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.08em', color: TEXT_SECONDARY, textTransform: 'uppercase', marginBottom: 8 }}>
            {draft.mess_name}
          </div>
          <OrderLines items={draft.items} total={draft.total} />
        </div>
      )}
      <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 11.5, fontWeight: 600, color: TEXT_SECONDARY }}>
        Your name
        <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" placeholder="e.g. Mathew" style={fieldStyle} />
      </label>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 11.5, fontWeight: 600, color: TEXT_SECONDARY }}>
        M-Pesa number
        <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" autoComplete="tel" placeholder="07XXXXXXXX" style={fieldStyle} />
      </label>
      <div style={{ fontSize: 11, color: TEXT_SECONDARY, lineHeight: 1.5 }}>Saved on this account so you only do this once.</div>
      <button type="submit" style={{
        fontSize: 14, fontWeight: 800, color: '#fff', fontFamily: 'inherit', border: 'none', borderRadius: 12,
        padding: '13px 0', cursor: 'pointer', background: ACCENT,
      }}>
        Continue
      </button>
    </form>
  )
}

  return (
    <form onSubmit={handleSubmit} style={{
      marginTop: 10, border: `1px solid ${BORDER}`, borderRadius: 14, padding: 14,
      background: 'rgba(15,15,26,0.5)', display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 300,
    }}>
      <input
        value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name"
        style={{ border: `1px solid ${BORDER}`, borderRadius: 8, padding: '8px 10px', fontSize: 12.5, background: SURFACE, color: TEXT_PRIMARY, fontFamily: 'inherit' }}
      />
      <input
        value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="07XXXXXXXX"
        style={{ border: `1px solid ${BORDER}`, borderRadius: 8, padding: '8px 10px', fontSize: 12.5, background: SURFACE, color: TEXT_PRIMARY, fontFamily: 'inherit' }}
      />
      <button type="submit" style={{
        fontSize: 12, fontWeight: 700, color: '#fff', fontFamily: 'inherit', border: 'none', borderRadius: 9,
        padding: '8px 0', cursor: 'pointer', background: 'linear-gradient(135deg,#a78bfa,#6c63ff)',
      }}>
        Continue
      </button>
    </form>
  )
}

function ActionCard({ action, message, onOpenService, onConfirm, onCateringIntent }) {
  if (!action) return null

  if (action.type === 'SHOW_MENU') {
    return <CateringMenuCard action={action} message={message} onOrder={onCateringIntent} />
  }

  if (action.type === 'CATERING_DETAILS_REQUIRED') {
    return <CateringDetailsForm action={action} message={message} onSubmit={onCateringIntent} />
  }

  if (action.type === 'CATERING_CONFIRM_REQUIRED') {
    return <CateringOrderCard action={action} message={message} onConfirm={onConfirm} onChange={onCateringIntent} />
  }

  if (action.type === 'CATERING_ORDER_PLACED') {
    const o = action.order || {}
    return (
      <div style={{ ...CARD_STYLE, padding: '14px 16px' }}>
        <div style={{ fontSize: 13.5, fontWeight: 800, color: '#6ee7b7' }}>Order placed · KSh {o.total}</div>
        <div style={{ fontSize: 12, color: TEXT_SECONDARY, marginTop: 4, lineHeight: 1.5 }}>
          {o.payment_status === 'prompted'
            ? `Check ${maskPhone(o.payment_phone || o.customer_phone)} for the payment prompt.`
            : 'Complete payment through the usual DeKUT process.'}
        </div>
      </div>
    )
  }

  if (action.type === 'CONFIRM_REQUIRED') {
    if (message.confirmed) {
      return <div style={{ marginTop: 8, fontSize: 11.5, color: TEXT_SECONDARY }}>Confirmed</div>
    }
    return (
      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
        <button onClick={() => onConfirm(message.id, action)} style={{
          fontSize: 11.5, fontWeight: 700, color: '#fff', fontFamily: 'inherit',
          border: 'none', borderRadius: 9, padding: '7px 14px', cursor: 'pointer',
          background: 'linear-gradient(135deg,#a78bfa,#6c63ff)',
        }}>
          Yes, submit it
        </button>
        <button onClick={() => onConfirm(message.id, null)} style={{
          fontSize: 11.5, fontWeight: 700, color: TEXT_SECONDARY, fontFamily: 'inherit',
          border: `1px solid ${BORDER}`, borderRadius: 9, padding: '7px 14px', cursor: 'pointer', background: 'none',
        }}>
          Not now
        </button>
      </div>
    )
  }

  const serviceId = ACTION_SERVICE_ID[action.type]
  const label = ACTION_LABEL[action.type]
  if (!serviceId || !label) return null

  return (
    <button onClick={() => onOpenService(serviceId, action)} style={{
      display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 10,
      fontSize: 11.5, fontWeight: 700, color: '#c4b5fd', fontFamily: 'inherit',
      border: '1px solid rgba(167,139,250,0.4)', borderRadius: 9, padding: '7px 12px',
      cursor: 'pointer', background: 'rgba(167,139,250,0.08)',
    }}>
      {label} <DekutIcon type="chevronRight" size={12} color="#c4b5fd" strokeWidth={2.2} />
    </button>
  )
}

function MessageBubble({ message, onOpenService, onConfirm, onCateringIntent }) {
  const isUser = message.role === 'user'
    const wide = ['SHOW_MENU', 'CATERING_DETAILS_REQUIRED', 'CATERING_CONFIRM_REQUIRED', 'CATERING_ORDER_PLACED'].includes(message.action?.type)
  return (
    <div style={{
      display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start', alignItems: 'flex-end', gap: 8,
      animation: 'curryMsgIn 220ms ease',
    }}>
      {!isUser && (
        <div style={{ width: 22, height: 22, flexShrink: 0, marginBottom: 2 }}>
          <CurryOrbGraphic size={22} state="idle" animate={false} />
        </div>
      )}
      <div style={{
        maxWidth: wide ? '100%' : '78%',
        minWidth: 0,
        flex: wide ? '1 1 auto' : undefined,
        background: isUser ? 'linear-gradient(135deg,#a78bfa,#6c63ff)' : SURFACE,
        border: isUser ? 'none' : `1px solid ${BORDER}`,
        color: isUser ? '#fff' : message.error ? '#fca5a5' : TEXT_PRIMARY,
        borderRadius: isUser ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
        padding: '10px 13px', fontSize: 13, lineHeight: 1.5,
      }}>
         <div style={{ whiteSpace: 'pre-line' }}>
          {isUser || message.error ? message.text : <StreamingText text={message.text} />}
        </div>
        {!isUser && <SourceChips sources={message.sources} />}
        {!isUser && <ActionCard ... />}
      </div>
    </div>
  )
}

// The empty-state hero — the actual "first glance" moment. Radar rings
// behind the beacon extend its own visual language rather than adding a
// second, unrelated decoration; the quick actions are icon-led cards
// that glow in their own color on hover, not plain text pills.
function CurryHero({ onQuickAction }) {
  return (
    <div style={{ position: 'relative', textAlign: 'center', padding: '30px 6px 6px' }}>
      <div aria-hidden="true" style={{
        position: 'absolute', top: 2, left: '50%', transform: 'translateX(-50%)',
        width: 260, height: 260, pointerEvents: 'none',
      }}>
        {[0, 1, 2].map((i) => (
          <div key={i} style={{ position: 'absolute', inset: i * 42, borderRadius: '50%', border: '1px dashed rgba(167,139,250,0.16)' }} />
        ))}
      </div>

      <div style={{ position: 'relative', display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
        <CurryOrbGraphic size={84} state="idle" animate />
      </div>

      <div style={{ position: 'relative', fontSize: 17, fontWeight: 800, color: TEXT_PRIMARY, marginBottom: 6 }}>Hey! I'm Curry.</div>
      <div style={{ position: 'relative', fontSize: 12.5, color: TEXT_SECONDARY, marginBottom: 20, maxWidth: 320, marginLeft: 'auto', marginRight: 'auto', lineHeight: 1.5 }}>
        I can help you navigate DeKUT, understand procedures, and get to campus services.
      </div>

      <div style={{ position: 'relative', display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, textAlign: 'left' }}>
        {QUICK_ACTIONS.map((qa, i) => (
          <button
            key={qa.text}
            onClick={() => onQuickAction(qa.text)}
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              gridColumn: i === QUICK_ACTIONS.length - 1 ? '1 / -1' : 'auto',
              background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 14, padding: '10px 12px',
              cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
              transition: 'transform 160ms ease, border-color 160ms ease, box-shadow 160ms ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)'
              e.currentTarget.style.borderColor = qa.color
              e.currentTarget.style.boxShadow = `0 8px 20px -10px ${qa.color}`
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)'
              e.currentTarget.style.borderColor = BORDER
              e.currentTarget.style.boxShadow = 'none'
            }}
          >
            <div style={{ width: 30, height: 30, borderRadius: 9, flexShrink: 0, background: `${qa.color}22`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <DekutIcon type={qa.icon} size={15} color={qa.color} strokeWidth={2.2} />
            </div>
            <span style={{ fontSize: 12, fontWeight: 600, color: TEXT_PRIMARY, lineHeight: 1.3 }}>{qa.text}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

function TypingIndicator() {
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-start', alignItems: 'flex-end', gap: 8 }}>
      <div style={{ width: 22, height: 22, flexShrink: 0, marginBottom: 2 }}>
        <CurryOrbGraphic size={22} state="thinking" animate />
      </div>
      <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: '14px 14px 14px 4px', padding: '11px 14px', display: 'flex', gap: 4, alignItems: 'center' }}>
        {[0, 1, 2].map((i) => (
          <span key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: TEXT_SECONDARY, animation: `curryBounce 1.1s ${i * 0.15}s infinite ease-in-out` }} />
        ))}
      </div>
    </div>
  )
}

function VoiceMode({ voice }) {
  const { supported, listening, thinking, speaking, volume, transcript, error, cancelSpeech } = voice

  // Nothing to tap during listening/thinking — the loop is automatic.
  // The only interactive moment is barge-in: tap to interrupt Curry
  // mid-sentence and jump straight back to listening.
  const handleOrbTap = () => {
    if (speaking) cancelSpeech()
  }

  if (!supported) {
    return (
      <div style={{ textAlign: 'center', padding: '40px 20px', color: TEXT_SECONDARY, fontSize: 13 }}>
        Voice mode isn't supported in this browser — it needs microphone access.
      </div>
    )
  }

  const orbState = listening ? 'listening' : thinking ? 'thinking' : speaking ? 'speaking' : 'idle'
  const glowColor = { idle: 'rgba(108,99,255,0.35)', listening: 'rgba(34,211,238,0.4)', thinking: 'rgba(245,158,11,0.4)', speaking: 'rgba(249,115,22,0.4)' }[orbState]
  const caption = listening
    ? 'Listening…'
    : thinking
      ? 'Thinking…'
      : speaking
        ? (transcript ? `You said: "${transcript}"` : 'Curry is speaking…')
        : error || 'Starting up…'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, minHeight: 320, gap: 24 }}>
      <button
        onClick={handleOrbTap}
        aria-label={speaking ? 'Stop Curry speaking' : 'Curry voice'}
        style={{
          width: 176, height: 176, borderRadius: '50%', border: 'none',
          cursor: speaking ? 'pointer' : 'default',
          background: 'transparent', boxShadow: `0 0 60px 10px ${glowColor}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'box-shadow 200ms ease',
        }}
      >
        <CurryOrbGraphic size={160} state={orbState} volume={volume} animate />
      </button>
      <div style={{ fontSize: 13.5, color: (!listening && !thinking && !speaking && error) ? '#fca5a5' : TEXT_PRIMARY, textAlign: 'center', maxWidth: 300, lineHeight: 1.5, minHeight: 40 }}>
        {caption}
      </div>
    </div>
  )
}

export default function AskCurry({ userId, onNavigate, onClose }) {
  const { messages, sending, sendMessage, sendIntent, confirmAction, declineAction } = useCurryChat({ userId })
  const voice = useCurryVoice()
  const [input, setInput] = useState('')
  const [inputFocused, setInputFocused] = useState(false)
  const [mode, setMode] = useState('chat') // 'chat' | 'voice'
  const scrollRef = useRef(null)
  const usage = useDekutUsage('dekut')
  const handleVoiceTurnRef = useRef(null) // always points at the latest handleVoiceTurn, so the loop never calls a stale closure

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, sending])

  // Sends the transcribed speech to Curry and hands the reply text back
  // to useCurryVoice, which speaks it and then resumes listening.
  const handleVoiceTurn = useCallback(async (text) => sendMessage(text), [sendMessage])
  handleVoiceTurnRef.current = handleVoiceTurn
  // Stable indirection so the loop (started once per mode change) always
  // calls whatever handleVoiceTurn currently is, not a stale closure.
  const callLatestVoiceTurn = useCallback((text) => handleVoiceTurnRef.current(text), [])

  // Starts/stops the whole listen -> transcribe -> reply -> speak loop
  // as the student switches tabs — the loop itself is fully owned by
  // useCurryVoice now, this just turns it on/off.
  useEffect(() => {
    if (mode === 'voice') {
      voice.start(callLatestVoiceTurn)
    } else {
      voice.stop()
    }
    return () => voice.stop()
 
  }, [mode])

  const handleSend = (text) => {
    const value = (text ?? input).trim()
    if (!value) return
    sendMessage(value)
    setInput('')
  }

  // For SHOW_LOCATION/SHOW_ROUTE, forwards origin/destination/location
  // data as a third onNavigate argument, so whatever mounts RoomFinder
  // can pass originLocationId/destinationLocationId into DekutCampusMap
  // and it opens already routed. RoomFinder.jsx and PulsePage's
  // onNavigate handler need a small update to actually read this third
  // argument — right now it's forwarded as far as this component reaches.
  const handleOpenService = (serviceId, action) => {
    const service = getServiceById(serviceId, DEKUT_CATEGORIES)
    if (!service) return
    const routeContext = action?.type === 'SHOW_ROUTE'
      ? { originLocationId: action.origin?.id, destinationLocationId: action.destination?.id }
      : action?.type === 'SHOW_LOCATION'
        ? { destinationLocationId: action.location?.id }
        : undefined
    openDekutService(service, { usage, onNavigate: routeContext ? (route, svc) => onNavigate?.(route, svc, routeContext) : onNavigate })
  }

  const handleConfirm = (messageId, action) => {
    if (action) confirmAction(messageId, action)
    else declineAction(messageId)
  }

  // Menu taps and the contact form both funnel here — sendIntent
  // handles both shapes (they just differ in what's in intentPayload).
  const handleCateringIntent = (intentPayload, summary, messageId) => {
    sendIntent(intentPayload, summary, messageId)
  }

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div aria-hidden="true" style={{ width: 38, height: 38, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CurryOrbGraphic size={38} state="idle" animate={false} />
          </div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, color: TEXT_PRIMARY }}>Curry</div>
            <div style={{ fontSize: 11.5, color: TEXT_SECONDARY }}>Your DeKUT campus assistant</div>
          </div>
        </div>
        {typeof onClose === 'function' && (
          <button onClick={onClose} aria-label="Close Ask Curry" style={{
            background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 10, width: 34, height: 34,
            display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0,
          }}>
            <DekutIcon type="x" size={16} color={TEXT_PRIMARY} strokeWidth={2.2} />
          </button>
        )}
      </div>

      {voice.supported && (
        <div style={{
          position: 'relative', display: 'flex', background: SURFACE, border: `1px solid ${BORDER}`,
          borderRadius: 999, padding: 3, marginTop: 14, width: 200,
        }}>
          <div aria-hidden="true" style={{
            position: 'absolute', top: 3, bottom: 3, left: mode === 'chat' ? 3 : 'calc(50% + 0px)',
            width: 'calc(50% - 6px)', borderRadius: 999,
            background: 'linear-gradient(135deg,#a78bfa,#6c63ff)',
            transition: 'left 220ms cubic-bezier(0.34,1.56,0.64,1)',
          }} />
          {[{ id: 'chat', label: 'Chat' }, { id: 'voice', label: 'Voice' }].map((t) => (
            <button
              key={t.id}
              onClick={() => setMode(t.id)}
              style={{
                position: 'relative', zIndex: 1, flex: 1,
                fontSize: 12, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer',
                border: 'none', borderRadius: 999, padding: '6px 0',
                background: 'transparent',
                color: mode === t.id ? '#fff' : TEXT_SECONDARY,
                transition: 'color 160ms ease',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}

      {mode === 'voice' ? (
        <VoiceMode voice={voice} />
      ) : (
        <>
          <div ref={scrollRef} style={{
            flex: 1, minHeight: 260, maxHeight: 'calc(100vh - 300px)', overflowY: 'auto',
            display: 'flex', flexDirection: 'column', gap: 10,
            border: `1px solid ${BORDER}`, borderRadius: 16, padding: 14,
            background: 'rgba(15,15,26,0.4)', margin: '16px 0 10px',
          }}>
            {messages.length === 0 && <CurryHero onQuickAction={handleSend} />}

            {messages.map((m) => (
              <MessageBubble key={m.id} message={m} onOpenService={handleOpenService} onConfirm={handleConfirm} onCateringIntent={handleCateringIntent} />
            ))}
            {sending && <TypingIndicator />}
          </div>

          <div style={{
            display: 'flex', alignItems: 'center', gap: 8, borderRadius: 12, padding: '9px 12px', background: SURFACE,
            border: `1px solid ${inputFocused ? '#a78bfa' : BORDER}`,
            boxShadow: inputFocused ? '0 0 0 3px rgba(167,139,250,0.18)' : 'none',
            transition: 'border-color 160ms ease, box-shadow 160ms ease',
          }}>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onFocus={() => setInputFocused(true)}
              onBlur={() => setInputFocused(false)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
              placeholder="Ask Curry anything about DeKUT..."
              style={{ border: 'none', outline: 'none', background: 'transparent', fontSize: 13.5, color: TEXT_PRIMARY, width: '100%', fontFamily: 'inherit' }}
            />
            <button onClick={() => handleSend()} disabled={sending || !input.trim()} aria-label="Send" style={{
              background: ICON_GRADIENTS.cpu, border: 'none', borderRadius: 9, width: 30, height: 30,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: sending || !input.trim() ? 'default' : 'pointer', opacity: sending || !input.trim() ? 0.5 : 1, flexShrink: 0,
            }}>
              <DekutIcon type="chevronRight" size={15} color="#fff" strokeWidth={2.4} />
            </button>
          </div>

          <div style={{ marginTop: 10, borderRadius: 14, border: `1px dashed ${BORDER}`, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 11.5, color: TEXT_SECONDARY }}>Curry not finding what you need?</div>
            </div>
            <a href="mailto:studentadmin@dkut.ac.ke" style={{ fontSize: 11.5, fontWeight: 700, color: '#c4b5fd', textDecoration: 'none', flexShrink: 0 }}>
              Email ICT
            </a>
          </div>
        </>
      )}

      <style>{`
        @keyframes curryMsgIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes curryBounce { 0%, 80%, 100% { opacity: 0.3; transform: translateY(0); } 40% { opacity: 1; transform: translateY(-3px); } }
      `}</style>
    </div>
  )
}
