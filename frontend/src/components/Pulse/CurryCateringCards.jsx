// src/components/Pulse/CurryCateringCards.jsx
//
// Every card Curry can put inside a chat bubble, including the catering
// flow. AskCurry.jsx imports the default-exported ActionCard from here
// instead of defining its own — this is the ONLY place these cards live.
//
// Phase 1 consolidation note: this file previously had a slimmer, visually
// nicer menu/order card that had drifted out of sync with a second,
// feature-complete copy that lived inline in AskCurry.jsx. That inline
// copy carried real functionality this file was missing — per-item stock
// counts, sold-out state, images, a live/last-updated badge, search for
// long menus, and a "change items" path distinct from "change contact
// info". All of that has been merged in here so nothing regresses.
// CATERING_USE_SAVED_REQUIRED (the "use your saved details?" quick-confirm
// for returning customers) was also missing from this file's router and
// has been added back.
//
// Calling convention for every card here: onIntent(payload, options)
// where options is an optional { userText?, replaceMessageId? } — never
// positional args. The chat surface (AskCurry.jsx) owns exactly one small
// adapter that turns this into useCurryChat's sendIntent(payload, summary,
// messageId) shape, so this file stays decoupled from that hook.
//
//   SHOW_MENU                    → CurryMenuCard        (browse + build order)
//   CATERING_DETAILS_REQUIRED    → CurryContactCard     (first order: name + phone)
//   CATERING_USE_SAVED_REQUIRED  → CurryUseSavedCard     (returning customer shortcut)
//   CATERING_CONFIRM_REQUIRED    → CurryOrderCard        (review + place)
//   CATERING_ORDER_PLACED        → CurryReceiptCard      (what happens next)

import React, { useMemo, useState } from 'react'
import { DekutIcon } from './dekutIcons'

const TEXT_PRIMARY = '#f5f5fa'
const TEXT_SECONDARY = 'rgba(245,245,250,0.6)'
const TEXT_MUTED = 'rgba(245,245,250,0.42)'
const BORDER = 'rgba(245,245,250,0.16)'
const SURFACE = 'rgba(245,245,250,0.06)'
const VIOLET = '#a78bfa'
const VIOLET_GRADIENT = 'linear-gradient(135deg,#a78bfa,#6c63ff)'
const MINT = '#6ee7b7'

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

// Enough of the number for the student to recognise as theirs, not
// enough to sit in a chat log in full.
export function maskPhone(phone) {
  if (!phone) return ''
  const digits = String(phone).replace(/\D/g, '')
  if (digits.length <= 3) return digits
  const local = digits.startsWith('254') ? `0${digits.slice(3)}` : digits
  return `${local.slice(0, 4)} ••• ${local.slice(-3)}`
}

function formatTime(iso) {
  if (!iso) return null
  try {
    return new Date(iso).toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Nairobi' })
  } catch {
    return null
  }
}

const shell = {
  marginTop: 10,
  border: `1px solid ${BORDER}`,
  borderRadius: 16,
  overflow: 'hidden',
  background: 'rgba(15,15,26,0.62)',
}

const inputStyle = {
  border: `1px solid ${BORDER}`, borderRadius: 10, padding: '9px 11px',
  fontSize: 12.5, background: 'rgba(15,15,26,0.9)', color: TEXT_PRIMARY,
  fontFamily: 'inherit', boxSizing: 'border-box', width: '100%', outline: 'none',
}

function CardHeader({ eyebrow, title, right }) {
  return (
    <div style={{
      padding: '11px 14px', borderBottom: `1px solid ${BORDER}`,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
    }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 10.5, fontWeight: 600, color: TEXT_MUTED }}>{eyebrow}</div>
        <div style={{ fontSize: 14, fontWeight: 700, color: TEXT_PRIMARY, marginTop: 1 }}>{title}</div>
      </div>
      {right}
    </div>
  )
}

function primaryButton(extra = {}) {
  return {
    fontSize: 12.5, fontWeight: 700, color: '#fff', fontFamily: 'inherit',
    border: 'none', borderRadius: 10, padding: '9px 16px', cursor: 'pointer',
    background: VIOLET_GRADIENT, ...extra,
  }
}

function quietButton(extra = {}) {
  return {
    fontSize: 12.5, fontWeight: 700, color: TEXT_SECONDARY, fontFamily: 'inherit',
    border: `1px solid ${BORDER}`, borderRadius: 10, padding: '9px 14px',
    cursor: 'pointer', background: 'none', ...extra,
  }
}

// ── Menu ─────────────────────────────────────────────────────────────────

function Stepper({ quantity, onChange, max = 20 }) {
  if (!quantity) {
    return (
      <button
        onClick={() => onChange(1)}
        aria-label="Add one"
        style={{
          width: 28, height: 28, borderRadius: 9, cursor: 'pointer', fontFamily: 'inherit',
          border: `1px solid ${BORDER}`, background: SURFACE, color: TEXT_PRIMARY,
          fontSize: 16, lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        +
      </button>
    )
  }
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 2, borderRadius: 9,
      border: `1px solid rgba(167,139,250,0.45)`, background: 'rgba(167,139,250,0.12)',
    }}>
      <button onClick={() => onChange(quantity - 1)} aria-label="Remove one" style={stepBtn}>−</button>
      <span style={{ fontSize: 12.5, fontWeight: 700, color: TEXT_PRIMARY, minWidth: 14, textAlign: 'center' }}>{quantity}</span>
      <button onClick={() => onChange(Math.min(max, quantity + 1))} disabled={quantity >= max} aria-label="Add one" style={{ ...stepBtn, opacity: quantity >= max ? 0.4 : 1 }}>+</button>
    </div>
  )
}

const stepBtn = {
  width: 26, height: 26, border: 'none', background: 'none', cursor: 'pointer',
  color: VIOLET, fontSize: 15, lineHeight: 1, fontFamily: 'inherit',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
}

// message is optional — when present, the card locks itself (renders
// nothing) once that message has been marked confirmed, and passes its id
// back as replaceMessageId so ordering from it locks the card in place
// rather than staying live and re-submittable underneath the reply that
// follows.
function CurryMenuCard({ action, message, sending, onIntent }) {
  const messes = action.messes || []
  const [messId, setMessId] = useState((messes.find((m) => m.open) || messes[0])?.id ?? null)
  const [cart, setCart] = useState({}) // item_id -> quantity
  const [query, setQuery] = useState('')

  if (message?.confirmed) return null

  const mess = messes.find((m) => m.id === messId) || messes[0]
  if (!mess) return null

  const switchMess = (id) => { setMessId(id); setQuery('') }

  const setQty = (itemId, qty) => setCart((prev) => {
    const next = { ...prev }
    if (qty <= 0) delete next[itemId]
    else next[itemId] = Math.min(20, qty)
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
    if (cartItems.length === 0 || sending) return
    onIntent(
      { intent: 'catering_draft', draft: { mess_id: mess.id, items: cartItems.map((i) => ({ item_id: i.id, quantity: i.quantity })) } },
      {
        userText: `${cartItems.map((i) => `${i.quantity} × ${i.name}`).join(', ')} from ${mess.name}`,
        replaceMessageId: message?.id,
      }
    )
    setCart({})
  }

  return (
    <div style={shell}>
      <div style={{ padding: '12px 16px 4px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: TEXT_PRIMARY }}>Today's menu</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: TEXT_SECONDARY }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: action.live ? '#34d399' : '#f59e0b' }} />
          {action.live ? (asOf ? `Live · ${asOf}` : 'Live') : (asOf ? `Last updated ${asOf}` : 'May be out of date')}
        </div>
      </div>

      {messes.length > 1 && (
        <div style={{ display: 'flex', gap: 8, padding: '10px 16px 12px', overflowX: 'auto' }}>
          {messes.map((m) => {
            const active = m.id === mess.id
            const inCart = countIn(m)
            return (
              <button key={m.id} onClick={() => switchMess(m.id)} style={{
                flexShrink: 0, textAlign: 'left', fontFamily: 'inherit', cursor: 'pointer',
                padding: '8px 12px', borderRadius: 12, minWidth: 96,
                border: `1px solid ${active ? VIOLET : BORDER}`,
                background: active ? 'rgba(167,139,250,0.14)' : SURFACE,
                opacity: m.open || active ? 1 : 0.65,
              }}>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: TEXT_PRIMARY, display: 'flex', alignItems: 'center', gap: 6 }}>
                  {m.name}
                  {inCart > 0 && <span style={{ fontSize: 10, background: VIOLET, color: '#fff', borderRadius: 999, padding: '1px 6px' }}>{inCart}</span>}
                </div>
                <div style={{ fontSize: 10.5, marginTop: 2, color: m.open ? MINT : TEXT_SECONDARY }}>
                  {m.open ? `${m.available_count} available` : 'Nothing on now'}
                </div>
              </button>
            )
          })}
        </div>
      )}

      {mess.items.length > 8 && (
        <div style={{ padding: '0 16px 10px' }}>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={`Search ${mess.name}`} style={inputStyle} />
        </div>
      )}

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
              {soldOut
                ? <span style={{ fontSize: 11.5, fontWeight: 700, color: TEXT_SECONDARY }}>Sold out</span>
                : <Stepper quantity={qty} max={Math.min(20, left)} onChange={(q) => setQty(item.id, q)} />}
            </div>
          )
        })}
      </div>

      <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, borderTop: `1px solid ${BORDER}` }}>
        <div style={{ flex: 1, fontSize: 13, color: TEXT_PRIMARY }}>
          {count > 0
            ? <><span style={{ fontWeight: 800 }}>{count} item{count > 1 ? 's' : ''}</span><span style={{ color: TEXT_SECONDARY }}> · KSh {total}</span></>
            : <span style={{ color: TEXT_SECONDARY }}>Tap + to start your order</span>}
        </div>
        <button onClick={handleOrder} disabled={count === 0 || sending} style={primaryButton({
          padding: '10px 18px',
          opacity: count === 0 || sending ? 0.4 : 1,
          cursor: count === 0 || sending ? 'default' : 'pointer',
        })}>
          Review order
        </button>
      </div>
    </div>
  )
}

// ── First order / edit contact: name + phone ────────────────────────────

function CurryContactCard({ message, action, sending, onIntent, initial, onCancel }) {
  const [name, setName] = useState(initial?.customer_name || '')
  const [phone, setPhone] = useState(initial?.customer_phone ? `0${String(initial.customer_phone).replace(/\D/g, '').slice(3)}` : '')
  const [touched, setTouched] = useState(false)

  const phoneOk = /^(?:\+?254|0)?[17]\d{8}$/.test(phone.replace(/\s/g, ''))
  const nameOk = name.trim().length >= 2
  const ready = phoneOk && nameOk && !sending

  if (message.confirmed) {
    return <div style={{ marginTop: 8, fontSize: 11.5, color: TEXT_SECONDARY }}>Details saved</div>
  }

  const submit = () => {
    if (!ready) return
    onIntent(
      { intent: 'save_contact', customer_name: name.trim(), customer_phone: phone.trim(), draft: action.draft ?? null },
      { replaceMessageId: message.id }
    )
  }

  return (
    <div style={shell}>
      <CardHeader eyebrow="Payment details" title="Who's this order for?" />
      <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => setTouched(true)}
          placeholder="Your name"
          style={inputStyle}
        />
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          onBlur={() => setTouched(true)}
          onKeyDown={(e) => { if (e.key === 'Enter') submit() }}
          inputMode="tel"
          placeholder="07XX XXX XXX"
          style={inputStyle}
        />
        <div style={{ fontSize: 11, color: touched && phone && !phoneOk ? '#fca5a5' : TEXT_SECONDARY, lineHeight: 1.45 }}>
          {touched && phone && !phoneOk
            ? 'That number needs to be a Kenyan line, like 0712345678.'
            : 'The payment prompt goes to this number. I\'ll remember it for next time.'}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, padding: '10px 14px', borderTop: `1px solid ${BORDER}` }}>
        <button onClick={submit} disabled={!ready} style={primaryButton({ flex: 1, opacity: ready ? 1 : 0.45, cursor: ready ? 'pointer' : 'default' })}>
          Save and continue
        </button>
        {onCancel && <button onClick={onCancel} style={quietButton()}>Cancel</button>}
      </div>
    </div>
  )
}

// ── Returning customer: use saved details? ──────────────────────────────

function CurryUseSavedCard({ action, message, sending, onIntent }) {
  if (message.confirmed) {
    return <div style={{ marginTop: 8, fontSize: 11.5, color: TEXT_SECONDARY }}>Confirmed</div>
  }
  return (
    <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
      <button
        onClick={() => onIntent(
          { intent: 'catering_use_saved', draft: action.draft, use_saved: true },
          { userText: 'Yes, the usual', replaceMessageId: message.id }
        )}
        disabled={sending}
        style={primaryButton({ fontSize: 11.5, padding: '7px 14px', opacity: sending ? 0.6 : 1, cursor: sending ? 'default' : 'pointer' })}
      >
        Yes, use my details
      </button>
      <button
        onClick={() => onIntent(
          { intent: 'catering_use_saved', draft: action.draft, use_saved: false },
          { userText: 'Different details', replaceMessageId: message.id }
        )}
        disabled={sending}
        style={quietButton({ fontSize: 11.5, padding: '7px 14px' })}
      >
        Use different details
      </button>
    </div>
  )
}

// ── Review and place ─────────────────────────────────────────────────────

function CurryOrderCard({ action, message, sending, onConfirm, onIntent }) {
  const [editingNumber, setEditingNumber] = useState(false)
  const { mess_name, mess_id, items, total, customer_name, customer_phone } = action.args || {}

  if (message.confirmed) {
    return <div style={{ marginTop: 8, fontSize: 11.5, color: TEXT_SECONDARY }}>{message.declined ? 'Not ordered' : 'Sent to the kitchen'}</div>
  }

  if (editingNumber) {
    return (
      <CurryContactCard
        message={message}
        action={{ draft: { mess_id: mess_id ?? action.args.mess_id, items: (items || []).map((i) => ({ item_id: i.item_id, quantity: i.quantity })) } }}
        sending={sending}
        onIntent={onIntent}
        initial={{ customer_name, customer_phone }}
        onCancel={() => setEditingNumber(false)}
      />
    )
  }

  return (
    <div style={shell}>
      <CardHeader eyebrow="DeKUT Catering" title={mess_name} />
      <div style={{ padding: '11px 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {(items || []).map((item, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, color: TEXT_PRIMARY }}>
            <span>{item.quantity} × {item.name}</span>
            <span style={{ color: TEXT_SECONDARY }}>KSh {item.unit_price * item.quantity}</span>
          </div>
        ))}
        <div style={{
          display: 'flex', justifyContent: 'space-between', fontSize: 13.5, fontWeight: 700,
          color: TEXT_PRIMARY, marginTop: 3, paddingTop: 9, borderTop: `1px solid ${BORDER}`,
        }}>
          <span>Total</span>
          <span>KSh {total}</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
          <div style={{ flex: 1, minWidth: 0, fontSize: 11.5, color: TEXT_SECONDARY }}>
            {customer_name} · {maskPhone(customer_phone)}
          </div>
          <button
            onClick={() => setEditingNumber(true)}
            style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: 'inherit', fontSize: 11.5, fontWeight: 700, color: '#c4b5fd' }}
          >
            Change
          </button>
        </div>
      </div>

      <div style={{ padding: '10px 14px 0', borderTop: `1px solid ${BORDER}` }}>
        <button
          onClick={() => onConfirm(message.id, action)}
          disabled={sending}
          style={primaryButton({ width: '100%', opacity: sending ? 0.5 : 1, cursor: sending ? 'default' : 'pointer' })}
        >
          {sending ? 'Placing…' : `Place order · KSh ${total}`}
        </button>
      </div>
      <div style={{ display: 'flex', gap: 8, padding: '8px 14px 12px' }}>
        <button
          onClick={() => onIntent({ intent: 'catering_menu', mess: mess_name }, { userText: 'Change my order', replaceMessageId: message.id })}
          style={quietButton({ flex: 1, fontSize: 11.5, padding: '8px 0' })}
        >
          Change items
        </button>
        <button onClick={() => onConfirm(message.id, null)} style={quietButton({ flex: 1, fontSize: 11.5, padding: '8px 0' })}>
          Cancel
        </button>
      </div>
    </div>
  )
}

// ── Placed ───────────────────────────────────────────────────────────────

function CurryReceiptCard({ action }) {
  const order = action.order || {}
  const prompted = order.payment_status === 'prompted'
  return (
    <div style={{ ...shell, borderColor: 'rgba(52,211,153,0.35)' }}>
      <div style={{ padding: '11px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 30, height: 30, borderRadius: 10, flexShrink: 0, background: 'rgba(52,211,153,0.14)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <DekutIcon type="check" size={15} color={MINT} strokeWidth={2.4} />
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: TEXT_PRIMARY }}>Order placed · KSh {order.total}</div>
          <div style={{ fontSize: 11.5, color: TEXT_SECONDARY, marginTop: 1 }}>
            {prompted
              ? `Payment prompt sent to ${maskPhone(order.payment_phone || order.customer_phone)}`
              : 'Pay through the usual DeKUT process — ordering here doesn\'t charge you'}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Router ───────────────────────────────────────────────────────────────

export default function ActionCard({ action, message, sending, onOpenService, onConfirm, onIntent }) {
  if (!action) return null

  switch (action.type) {
    case 'SHOW_MENU':
      return <CurryMenuCard action={action} message={message} sending={sending} onIntent={onIntent} />
    case 'CATERING_DETAILS_REQUIRED':
      return <CurryContactCard action={action} message={message} sending={sending} onIntent={onIntent} />
    case 'CATERING_USE_SAVED_REQUIRED':
      return <CurryUseSavedCard action={action} message={message} sending={sending} onIntent={onIntent} />
    case 'CATERING_CONFIRM_REQUIRED':
      return <CurryOrderCard action={action} message={message} sending={sending} onConfirm={onConfirm} onIntent={onIntent} />
    case 'CATERING_ORDER_PLACED':
      return <CurryReceiptCard action={action} />
    default:
      break
  }

  if (action.type === 'CONFIRM_REQUIRED') {
    if (message.confirmed) {
      return <div style={{ marginTop: 8, fontSize: 11.5, color: TEXT_SECONDARY }}>{message.declined ? 'Not submitted' : 'Submitted'}</div>
    }
    return (
      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
        <button onClick={() => onConfirm(message.id, action)} disabled={sending} style={primaryButton({ fontSize: 11.5, padding: '7px 14px' })}>
          Submit it
        </button>
        <button onClick={() => onConfirm(message.id, null)} style={quietButton({ fontSize: 11.5, padding: '7px 14px' })}>
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
