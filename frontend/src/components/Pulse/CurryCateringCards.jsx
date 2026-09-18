// src/components/Pulse/CurryCateringCards.jsx
//
// Every card Curry can put inside a chat bubble, including the catering
// flow. AskCurry.jsx imports ActionCard from here instead of defining
// its own — see the integration notes.
//
// The catering cards are the ordering flow. They are deliberately the
// only place an order is assembled: the student taps real menu rows,
// the card sends real item ids, and the edge function does the pricing.
// Nothing here ever computes or displays a price the backend didn't
// send, and nothing here can submit twice (message.confirmed locks it).
//
//   SHOW_MENU                  → CurryMenuCard      (browse + build order)
//   CATERING_DETAILS_REQUIRED  → CurryContactCard   (first order: name + phone)
//   CATERING_CONFIRM_REQUIRED  → CurryOrderCard     (review + place)
//   CATERING_ORDER_PLACED      → CurryReceiptCard   (what happens next)

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

const shell = {
  marginTop: 10,
  border: `1px solid ${BORDER}`,
  borderRadius: 16,
  overflow: 'hidden',
  background: 'rgba(15,15,26,0.62)',
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

function Stepper({ quantity, onChange }) {
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
      <button onClick={() => onChange(quantity + 1)} aria-label="Add one" style={stepBtn}>+</button>
    </div>
  )
}

const stepBtn = {
  width: 26, height: 26, border: 'none', background: 'none', cursor: 'pointer',
  color: VIOLET, fontSize: 15, lineHeight: 1, fontFamily: 'inherit',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
}

function CurryMenuCard({ action, sending, onIntent }) {
  const messes = action.messes || []
  const [activeMessId, setActiveMessId] = useState(messes[0]?.id)
  const [picked, setPicked] = useState({}) // item_id -> quantity

  const mess = messes.find((m) => m.id === activeMessId) || messes[0]
  if (!mess) return null

  // Switching mess clears the basket: you can't order across two
  // kitchens in one order, and silently dropping items would be worse.
  const switchMess = (id) => { setActiveMessId(id); setPicked({}) }

  const setQty = (itemId, qty) => {
    setPicked((prev) => {
      const next = { ...prev }
      if (qty <= 0) delete next[itemId]
      else next[itemId] = Math.min(20, qty)
      return next
    })
  }

  const chosen = useMemo(
    () => mess.items.filter((i) => picked[i.id]).map((i) => ({ ...i, quantity: picked[i.id] })),
    [mess, picked]
  )
  const count = chosen.reduce((n, i) => n + i.quantity, 0)
  const total = chosen.reduce((sum, i) => sum + i.unit_price * i.quantity, 0)

  const grouped = useMemo(() => {
    const groups = new Map()
    for (const item of mess.items) {
      const key = item.category || 'On the menu'
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key).push(item)
    }
    return [...groups.entries()]
  }, [mess])

  const placeOrder = () => {
    if (chosen.length === 0 || sending) return
    onIntent(
      {
        intent: 'catering_draft',
        draft: { mess_id: mess.id, items: chosen.map((i) => ({ item_id: i.id, quantity: i.quantity })) },
      },
      { userText: `${chosen.map((i) => `${i.quantity} × ${i.name}`).join(', ')} from ${mess.name}` }
    )
    setPicked({})
  }

  return (
    <div style={shell}>
      <CardHeader
        eyebrow="Serving now"
        title={mess.name}
        right={mess.notes ? <span style={{ fontSize: 11, color: TEXT_SECONDARY, textAlign: 'right' }}>{mess.notes}</span> : null}
      />

      {messes.length > 1 && (
        <div style={{ display: 'flex', gap: 6, padding: '9px 14px 3px', flexWrap: 'wrap' }}>
          {messes.map((m) => (
            <button
              key={m.id}
              onClick={() => switchMess(m.id)}
              style={{
                fontSize: 11.5, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer',
                borderRadius: 999, padding: '5px 11px',
                border: `1px solid ${m.id === mess.id ? 'rgba(167,139,250,0.5)' : BORDER}`,
                background: m.id === mess.id ? 'rgba(167,139,250,0.14)' : 'transparent',
                color: m.id === mess.id ? '#c4b5fd' : TEXT_SECONDARY,
              }}
            >
              {m.name}
            </button>
          ))}
        </div>
      )}

      <div style={{ maxHeight: 268, overflowY: 'auto', padding: '4px 14px 10px' }}>
        {grouped.map(([category, items]) => (
          <div key={category} style={{ marginTop: 10 }}>
            {grouped.length > 1 && (
              <div style={{ fontSize: 11, fontWeight: 600, color: TEXT_MUTED, marginBottom: 4 }}>{category}</div>
            )}
            {items.map((item) => {
              const qty = picked[item.id] || 0
              return (
                <div
                  key={item.id}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0',
                    borderBottom: `1px solid rgba(245,245,250,0.07)`,
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12.8, fontWeight: 600, color: TEXT_PRIMARY }}>{item.name}</div>
                    {qty > 0 && (
                      <div style={{ fontSize: 10.5, color: '#c4b5fd', marginTop: 1 }}>
                        KSh {item.unit_price * qty}
                      </div>
                    )}
                  </div>
                  <div style={{ fontSize: 12.5, color: qty ? TEXT_SECONDARY : TEXT_PRIMARY, fontWeight: 600, whiteSpace: 'nowrap' }}>
                    KSh {item.unit_price}
                  </div>
                  <Stepper quantity={qty} onChange={(q) => setQty(item.id, q)} />
                </div>
              )
            })}
          </div>
        ))}
      </div>

      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
        borderTop: `1px solid ${BORDER}`,
        background: count ? 'rgba(167,139,250,0.08)' : 'transparent',
        transition: 'background 180ms ease',
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          {count ? (
            <>
              <div style={{ fontSize: 13, fontWeight: 700, color: TEXT_PRIMARY }}>KSh {total}</div>
              <div style={{ fontSize: 11, color: TEXT_SECONDARY }}>{count} item{count === 1 ? '' : 's'} from {mess.name}</div>
            </>
          ) : (
            <div style={{ fontSize: 11.5, color: TEXT_SECONDARY }}>Tap what you want and I'll total it up.</div>
          )}
        </div>
        <button
          onClick={placeOrder}
          disabled={!count || sending}
          style={primaryButton({
            opacity: !count || sending ? 0.45 : 1,
            cursor: !count || sending ? 'default' : 'pointer',
          })}
        >
          Order
        </button>
      </div>
    </div>
  )
}

// ── First order: name + phone ────────────────────────────────────────────

const inputStyle = {
  border: `1px solid ${BORDER}`, borderRadius: 10, padding: '9px 11px',
  fontSize: 12.5, background: 'rgba(15,15,26,0.9)', color: TEXT_PRIMARY,
  fontFamily: 'inherit', boxSizing: 'border-box', width: '100%', outline: 'none',
}

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

// ── Review and place ─────────────────────────────────────────────────────

function CurryOrderCard({ action, message, sending, onConfirm, onIntent }) {
  const [editingNumber, setEditingNumber] = useState(false)
  const { mess_name, items, total, customer_name, customer_phone } = action.args || {}

  if (message.confirmed) {
    return <div style={{ marginTop: 8, fontSize: 11.5, color: TEXT_SECONDARY }}>{message.declined ? 'Not ordered' : 'Sent to the kitchen'}</div>
  }

  if (editingNumber) {
    return (
      <CurryContactCard
        message={message}
        action={{ draft: { mess_id: action.args.mess_id, items: items.map((i) => ({ item_id: i.item_id, quantity: i.quantity })) } }}
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
      <div style={{ display: 'flex', gap: 8, padding: '10px 14px', borderTop: `1px solid ${BORDER}` }}>
        <button
          onClick={() => onConfirm(message.id, action)}
          disabled={sending}
          style={primaryButton({ flex: 1, opacity: sending ? 0.5 : 1, cursor: sending ? 'default' : 'pointer' })}
        >
          {sending ? 'Placing…' : 'Place order'}
        </button>
        <button onClick={() => onConfirm(message.id, null)} style={quietButton()}>Not now</button>
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
      return <CurryMenuCard action={action} sending={sending} onIntent={onIntent} />
    case 'CATERING_DETAILS_REQUIRED':
      return <CurryContactCard action={action} message={message} sending={sending} onIntent={onIntent} />
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
