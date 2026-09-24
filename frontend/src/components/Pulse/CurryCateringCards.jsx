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
// Overlaid variant of the stepper — sits on top of the food photo,
// white circular chip with shadow (the DoorDash/Uber Eats "+" pattern),
// rather than the flat inline version used elsewhere.
function StepperOverlay({ quantity, onChange, max = 20, disabled }) {
  if (disabled) return null
  if (!quantity) {
    return (
      <button
        onClick={(e) => { e.stopPropagation(); onChange(1) }}
        aria-label="Add one"
        style={{
          position: 'absolute', right: 8, bottom: 8, width: 30, height: 30, borderRadius: '50%',
          border: 'none', cursor: 'pointer', background: '#fff', color: VIOLET,
          fontSize: 18, fontWeight: 800, lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 3px 10px rgba(0,0,0,0.35)',
        }}
      >
        +
      </button>
    )
  }
  return (
    <div style={{
      position: 'absolute', right: 8, bottom: 8, display: 'flex', alignItems: 'center', gap: 0,
      borderRadius: 999, background: '#fff', boxShadow: '0 3px 10px rgba(0,0,0,0.35)', overflow: 'hidden',
    }}>
      <button onClick={(e) => { e.stopPropagation(); onChange(quantity - 1) }} aria-label="Remove one" style={{
        width: 26, height: 30, border: 'none', background: 'none', cursor: 'pointer', color: VIOLET, fontSize: 15, fontWeight: 800, fontFamily: 'inherit',
      }}>−</button>
      <span style={{ fontSize: 12.5, fontWeight: 800, color: '#1a1a2e', minWidth: 16, textAlign: 'center' }}>{quantity}</span>
      <button onClick={(e) => { e.stopPropagation(); onChange(Math.min(max, quantity + 1)) }} disabled={quantity >= max} aria-label="Add one" style={{
        width: 26, height: 30, border: 'none', background: 'none', cursor: 'pointer', color: VIOLET, fontSize: 15, fontWeight: 800, fontFamily: 'inherit', opacity: quantity >= max ? 0.35 : 1,
      }}>+</button>
    </div>
  )
}

// A single food card — photo-forward, grid tile. This is the pattern
// Uber Eats/DoorDash/Domino's all converge on for chat-embedded menus:
// big image, price + name below it, quantity control overlaid bottom-right
// of the image rather than buried in a text row.
function MenuItemTile({ item, quantity, onChange }) {
  const [imgError, setImgError] = useState(false)
  const imageSrc = resolveItemImage(item)
  const left = item.available_quantity
  const soldOut = !item.is_available || left <= 0
  const lowStock = !soldOut && left <= 5

  return (
    <div style={{
      borderRadius: 14, overflow: 'hidden', background: SURFACE,
      border: `1px solid ${quantity > 0 ? 'rgba(167,139,250,0.55)' : BORDER}`,
      display: 'flex', flexDirection: 'column', opacity: soldOut ? 0.55 : 1,
      transition: 'border-color 140ms ease',
    }}>
      <div style={{ position: 'relative', width: '100%', aspectRatio: '1 / 1', background: 'rgba(255,255,255,0.04)' }}>
        {imageSrc && !imgError ? (
   <img
    src={imageSrc} alt={item.name} loading="lazy" referrerPolicy="no-referrer"
    onError={() => { console.warn('[menu] image failed to load:', imageSrc); setImgError(true) }}
    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
  />
        ) : (
          <div style={{
            width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 26, fontWeight: 800, color: TEXT_MUTED, background: 'linear-gradient(135deg, rgba(167,139,250,0.14), rgba(108,99,255,0.06))',
          }}>
            {item.name.charAt(0)}
          </div>
        )}
        {/* price chip — bottom-left over the photo, Domino's/UberEats style */}
        <div style={{
          position: 'absolute', left: 7, bottom: 7, fontSize: 11, fontWeight: 800, color: '#fff',
          background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)', borderRadius: 999, padding: '3px 8px',
        }}>
          KSh {item.unit_price}
        </div>
        {soldOut && (
          <div style={{
            position: 'absolute', inset: 0, background: 'rgba(10,10,16,0.55)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{ fontSize: 10.5, fontWeight: 800, color: '#fff', background: 'rgba(0,0,0,0.5)', borderRadius: 999, padding: '4px 10px' }}>
              Sold out
            </span>
          </div>
        )}
        {lowStock && (
          <div style={{
            position: 'absolute', top: 7, left: 7, fontSize: 9.5, fontWeight: 800, color: '#1a1a2e',
            background: '#fbbf24', borderRadius: 999, padding: '2px 7px',
          }}>
            {left} left
          </div>
        )}
        <StepperOverlay quantity={quantity} disabled={soldOut} onChange={(q) => onChange(item.id, q)} max={Math.min(20, left)} />
      </div>
      <div style={{ padding: '8px 9px 9px' }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: TEXT_PRIMARY, lineHeight: 1.3, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {item.name}
        </div>
      </div>
    </div>
  )
}

 // message is optional — when present, the card locks itself (renders
 // nothing) once that message has been marked confirmed, and passes its id
 // back as replaceMessageId so ordering from it locks the card in place
 // rather than staying live and re-submittable underneath the reply that
 // follows.
// ── Menu ─────────────────────────────────────────────────────────────────

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
  const SUPABASE_URL = 'https://bqerkvywgxoioocbkxif.supabase.co'
const MENU_IMAGE_BUCKET = 'catering' 

  const handleOrder = () => {
    if (cartItems.length === 0 || sending) return
    onIntent(
      { intent: 'catering_draft', draft: { mess_id: mess.id, items: cartItems.map((i) => ({ item_id: i.id, quantity: i.quantity })) } },
      {
        userText: `${cartItems.map((i) => `${i.quantity} ×${i.name}`).join(', ')} from ${mess.name}`,
        replaceMessageId: message?.id,
      }
    )
    setCart({})
  }

  return (
    <div style={{ ...shell, maxWidth: 380, borderColor: 'rgba(167,139,250,0.28)', boxShadow: '0 12px 32px -14px rgba(108,99,255,0.35)' }}>
      <div style={{
        padding: '13px 16px 12px', position: 'relative', overflow: 'hidden',
        background: 'linear-gradient(120deg, rgba(167,139,250,0.22), rgba(108,99,255,0.08))',
        borderBottom: `1px solid ${BORDER}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: TEXT_PRIMARY }}>🍽️ Today's menu</div>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 5, fontSize: 10.5, fontWeight: 700, color: TEXT_SECONDARY,
            background: 'rgba(0,0,0,0.25)', borderRadius: 999, padding: '3px 9px', flexShrink: 0,
          }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: action.live ? '#34d399' : '#f59e0b', flexShrink: 0 }} />
            {action.live ? (asOf ? `Live · ${asOf}` : 'Live') : (asOf ? `Updated ${asOf}` : 'May be out of date')}
          </div>
        </div>
      </div>

      {messes.length > 1 && (
        <div style={{ display: 'flex', gap: 8, padding: '12px 16px 10px', overflowX: 'auto' }}>
          {messes.map((m) => {
            const active = m.id === mess.id
            const inCart = countIn(m)
            return (
              <button key={m.id} onClick={() => switchMess(m.id)} style={{
                flexShrink: 0, textAlign: 'left', fontFamily: 'inherit', cursor: 'pointer',
                padding: '8px 13px', borderRadius: 999, minWidth: 0,
                border: `1px solid ${active ? VIOLET : BORDER}`,
                background: active ? 'rgba(167,139,250,0.14)' : SURFACE,
                opacity: m.open || active ? 1 : 0.65,
              }}>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: TEXT_PRIMARY, display: 'flex', alignItems: 'center', gap: 6 }}>
                  {m.name}
                  {inCart > 0 && <span style={{ fontSize: 10, background: VIOLET, color: '#fff', borderRadius: 999, padding: '1px 6px' }}>{inCart}</span>}
                </div>
              </button>
            )
          })}
        </div>
      )}

      {mess.items.length > 8 && (
        <div style={{ padding: '0 16px 10px' }}>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={`Search ${mess.name}`} style={{ ...inputStyle, borderRadius: 999 }} />
        </div>
      )}

      <div style={{
        maxHeight: 420, overflowY: 'auto', borderTop: `1px solid ${BORDER}`, padding: '12px 12px 4px',
        display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(128px, 1fr))', gap: 10,
      }}>
        {visible.length === 0 && (
          <div style={{ gridColumn: '1 / -1', padding: '28px 16px', textAlign: 'center', fontSize: 12.5, color: TEXT_SECONDARY, lineHeight: 1.5 }}>
            {mess.items.length === 0
              ? `Nothing is being served at ${mess.name} right now. Check back a little later.`
              : `No items match "${query}".`}
          </div>
        )}
        {visible.map((item) => (
          <MenuItemTile key={item.id} item={item} quantity={cart[item.id] || 0} onChange={setQty} />
        ))}
      </div>

      <div style={{
        padding: count > 0 ? '11px 14px' : '10px 16px', borderTop: `1px solid ${BORDER}`,
        display: 'flex', alignItems: 'center', gap: 10,
        background: count > 0 ? 'rgba(167,139,250,0.1)' : 'transparent',
        transition: 'background 160ms ease',
      }}>
        {count > 0 ? (
          <>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12.5, fontWeight: 800, color: TEXT_PRIMARY }}>{count} item{count > 1 ? 's' : ''} · KSh {total}</div>
              <div style={{ fontSize: 10.5, color: TEXT_SECONDARY, marginTop: 1 }}>{mess.name}</div>
            </div>
            <button onClick={handleOrder} disabled={sending} style={primaryButton({
              padding: '10px 18px', borderRadius: 999,
              opacity: sending ? 0.5 : 1, cursor: sending ? 'default' : 'pointer',
              boxShadow: '0 6px 16px -6px rgba(108,99,255,0.6)',
            })}>
              Review order →
            </button>
          </>
        ) : (
          <span style={{ fontSize: 11.5, color: TEXT_SECONDARY }}>Tap a photo's + to start your order</span>
        )}
      </div>
    </div>
  )
}
function resolveItemImage(item) {
  const raw = item.image_url || item.imageUrl || item.image || item.photo_url || item.picture_url
  if (!raw || typeof raw !== 'string') return null
  if (/^(https?:|data:|blob:)/i.test(raw)) return raw
  if (raw.startsWith('//')) return `https:${raw}`
  return `${SUPABASE_URL}/storage/v1/object/public/${MENU_IMAGE_BUCKET}/${raw.replace(/^\/+/, '')}`
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
  const number = maskPhone(action.customer_phone)
  return (
    <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
      <button
        onClick={() => onIntent(
          { intent: 'catering_use_saved', draft: action.draft, use_saved: true },
          { userText: `Send it to ${number}`, replaceMessageId: message.id }
        )}
        disabled={sending}
        style={primaryButton({ fontSize: 11.5, padding: '8px 14px', opacity: sending ? 0.6 : 1, cursor: sending ? 'default' : 'pointer' })}
      >
        Send to {number}
      </button>
      <button
        onClick={() => onIntent(
          { intent: 'catering_use_saved', draft: action.draft, use_saved: false },
          { userText: 'A different number', replaceMessageId: message.id }
        )}
        disabled={sending}
        style={quietButton({ fontSize: 11.5, padding: '8px 14px' })}
      >
        Different number
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

// ── Directions: watch a video or open the map ────────────────────────────

function RouteVideo({ type, url }) {
  if (type === 'upload') {
    return <video src={url} controls playsInline style={{ width: '100%', borderRadius: 10, background: '#000', maxHeight: 240 }} />
  }
  const yt = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([\w-]{6,})/)
  if (yt) {
    return (
      <div style={{ position: 'relative', width: '100%', aspectRatio: '16/9', borderRadius: 10, overflow: 'hidden' }}>
        <iframe src={`https://www.youtube.com/embed/${yt[1]}`} title="Walkthrough video"
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none' }}
          allow="encrypted-media; picture-in-picture" allowFullScreen />
      </div>
    )
  }
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12.5, fontWeight: 700, color: '#c4b5fd' }}>
      Open the walkthrough video
    </a>
  )
}

function CurryRouteOptionsCard({ action, onOpenService }) {
  const [showVideo, setShowVideo] = useState(false)
  const serviceId = 'room-finder'
  return (
    <div style={shell}>
      <CardHeader eyebrow="How do you want to get there?" title={action.name} />
      <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setShowVideo((v) => !v)} style={primaryButton({ flex: 1 })}>
            {showVideo ? 'Hide video' : 'Watch video'}
          </button>
          {action.has_map && (
            <button onClick={() => onOpenService(serviceId, action.map)} style={quietButton({ flex: 1 })}>
              Show map
            </button>
          )}
        </div>
        {showVideo && <RouteVideo type={action.video.type} url={action.video.url} />}
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
          case 'ROUTE_OPTIONS':
      return <CurryRouteOptionsCard action={action} onOpenService={onOpenService} />
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
