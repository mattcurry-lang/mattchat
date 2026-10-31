// src/components/SavedMessagesSheet.jsx
// "Saved messages": everything you starred or asked to be reminded about, in one place.
//   <SavedMessagesSheet open userId saves onClose onOpenMessage />   the list (tabs: All / Starred / Reminders)
//   <ReminderToast due onOpen onDismiss />                            the pop-up when a reminder comes due
// `saves` is the object returned by useMessageSaves() (lib/messageSaves.js).

import React, { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { IconStar, IconBell, IconX } from './Icons'
import { formatWhen } from '../lib/smartActions'
import { Z } from '../lib/zLayers'

const CSS = `
.mc-sv-back{position:fixed; inset:0; z-index:${Z.panel + 100}; display:flex; align-items:flex-end; justify-content:center; background:rgba(6,5,14,.6); -webkit-backdrop-filter:blur(5px); backdrop-filter:blur(5px); animation:backdropFadeIn .18s ease-out}
.mc-sv{width:min(560px,100%); height:min(78vh,680px); display:flex; flex-direction:column; background:#14141f; color:#f5f5fa; border:1px solid rgba(255,255,255,.1); border-radius:22px 22px 0 0; box-shadow:0 -20px 60px -20px rgba(0,0,0,.8); animation:sheetSlideUp .26s cubic-bezier(.2,.9,.3,1); font-family:inherit}
@media (min-width:700px){ .mc-sv-back{align-items:center} .mc-sv{border-radius:22px; animation:menuPop .2s ease-out} }
.mc-sv-head{display:flex; align-items:center; gap:10px; padding:16px 16px 8px}
.mc-sv-title{flex:1; font-size:17px; font-weight:800; letter-spacing:-.01em}
.mc-sv-x{width:32px; height:32px; border:0; border-radius:50%; display:grid; place-items:center; background:rgba(255,255,255,.08); color:inherit; cursor:pointer}
.mc-sv-tabs{display:flex; gap:6px; padding:4px 16px 10px}
.mc-sv-tab{border:0; border-radius:999px; padding:7px 13px; font:inherit; font-size:13px; font-weight:650; color:rgba(245,245,250,.7); background:rgba(255,255,255,.06); cursor:pointer}
.mc-sv-tab[aria-selected="true"]{color:#fff; background:#6c63ff}
.mc-sv-list{flex:1; min-height:0; overflow-y:auto; padding:2px 12px 18px; overscroll-behavior:contain}
.mc-sv-item{display:flex; gap:8px; align-items:flex-start; padding:11px 8px 11px 12px; margin-bottom:6px; border-radius:14px; background:rgba(255,255,255,.04)}
.mc-sv-main{flex:1; min-width:0; border:0; background:none; padding:0; text-align:left; color:inherit; font:inherit; cursor:pointer}
.mc-sv-who{font-size:12.5px; font-weight:700; color:#a78bfa}
.mc-sv-text{margin-top:2px; font-size:14px; line-height:1.4; display:-webkit-box; -webkit-line-clamp:3; -webkit-box-orient:vertical; overflow:hidden; word-break:break-word}
.mc-sv-meta{display:flex; flex-wrap:wrap; gap:6px; margin-top:6px}
.mc-sv-chip{display:inline-flex; align-items:center; gap:5px; padding:3px 9px; border-radius:999px; font-size:11.5px; font-weight:650; background:rgba(255,255,255,.08); color:rgba(245,245,250,.8)}
.mc-sv-chip--due{background:rgba(251,191,36,.18); color:#fbbf24}
.mc-sv-chip--star{background:rgba(251,191,36,.12); color:#fbbf24}
.mc-sv-del{width:30px; height:30px; flex:none; border:0; border-radius:50%; display:grid; place-items:center; background:transparent; color:rgba(245,245,250,.5); cursor:pointer}
.mc-sv-del:hover{background:rgba(255,255,255,.1); color:#fff}
.mc-sv-empty{padding:40px 24px; text-align:center; color:rgba(245,245,250,.6); font-size:14px; line-height:1.5}
.mc-sv-empty strong{display:block; color:#fff; font-size:15px; margin-bottom:4px}
.mc-sv-warn{margin:6px 4px 10px; padding:12px 14px; border-radius:14px; background:rgba(251,191,36,.1); border:1px solid rgba(251,191,36,.25); color:#fde68a; font-size:13px; line-height:1.45}
.mc-rt{position:fixed; left:50%; top:calc(env(safe-area-inset-top,0px) + 14px); transform:translateX(-50%); z-index:${Z.toast}; width:min(440px,calc(100vw - 24px)); display:flex; gap:12px; align-items:center; padding:12px 12px 12px 14px; border-radius:16px; background:#1e1b33; color:#f5f5fa; border:1px solid rgba(167,139,250,.4); box-shadow:0 18px 50px -12px rgba(0,0,0,.8); animation:menuPop .2s ease-out; font-family:inherit}
.mc-rt-body{flex:1; min-width:0}
.mc-rt-title{font-size:12px; font-weight:800; letter-spacing:.04em; text-transform:uppercase; color:#fbbf24}
.mc-rt-text{margin-top:2px; font-size:14px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis}
.mc-rt-btn{border:0; border-radius:999px; padding:7px 13px; font:inherit; font-size:13px; font-weight:700; cursor:pointer; color:#fff; background:#6c63ff}
.mc-rt-btn--ghost{background:rgba(255,255,255,.1)}
@media (prefers-reduced-motion:reduce){ .mc-sv,.mc-rt{animation:none} }
`
let styled = false
function ensureStyles() {
  if (styled || typeof document === 'undefined') return
  styled = true
  const el = document.createElement('style'); el.setAttribute('data-mc-saved', ''); el.textContent = CSS; document.head.appendChild(el)
}
ensureStyles()

const snippetOf = (s) => {
  const m = s.messages
  if (m?.content) return m.content
  if (m?.message_type && m.message_type !== 'text') return `[${m.message_type}]`
  return 'Message'
}

export function SavedMessagesSheet({ open, userId, saves, onClose, onOpenMessage }) {
  const [tab, setTab] = useState('all')
  useEffect(() => {
    if (!open) return undefined
    const onKey = (e) => { if (e.key === 'Escape') onClose?.() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const now = Date.now()
  const rows = useMemo(() => {
    const list = (saves?.saves || []).filter((s) => (tab === 'starred' ? s.starred : tab === 'reminders' ? !!s.remind_at : true))
    // reminders first (soonest due on top), then the rest newest first
    return [...list].sort((a, b) => {
      const ar = a.remind_at && !a.reminded_at; const br = b.remind_at && !b.reminded_at
      if (ar && br) return new Date(a.remind_at) - new Date(b.remind_at)
      if (ar !== br) return ar ? -1 : 1
      return new Date(b.created_at) - new Date(a.created_at)
    })
  }, [saves?.saves, tab])

  if (!open) return null

  const whoOf = (s) => (s.messages?.sender_id === userId ? 'You' : s.messages?.profiles?.username || 'Someone')
  const asMessage = (s) => ({ id: s.message_id, conversation_id: s.conversation_id, content: s.messages?.content, created_at: s.messages?.created_at, sender_id: s.messages?.sender_id, message_type: s.messages?.message_type })

  const empty = {
    all: ['Nothing saved yet', 'Open a message’s menu and choose Star or Remind me. It will show up here.'],
    starred: ['No starred messages', 'Star a message to keep it handy.'],
    reminders: ['No reminders', 'Choose “Remind me” on a message and it will come back to you at the time you pick.'],
  }[tab]

  return createPortal(
    <div className="mc-sv-back" onClick={onClose} role="presentation">
      <div className="mc-sv" role="dialog" aria-modal="true" aria-label="Saved messages" onClick={(e) => e.stopPropagation()}>
        <div className="mc-sv-head">
          <div className="mc-sv-title">Saved messages</div>
          <button type="button" className="mc-sv-x" onClick={onClose} aria-label="Close"><IconX size={16} /></button>
        </div>
        <div className="mc-sv-tabs" role="tablist">
          {[['all', 'All'], ['starred', 'Starred'], ['reminders', 'Reminders']].map(([id, label]) => (
            <button key={id} type="button" role="tab" aria-selected={tab === id} className="mc-sv-tab" onClick={() => setTab(id)}>{label}</button>
          ))}
        </div>
        <div className="mc-sv-list">
          {saves?.unavailable && (
            <div className="mc-sv-warn" role="alert">Saving isn’t switched on yet. Ask your admin to run <b>docs/step_message_saves.sql</b> in Supabase.</div>
          )}
          {rows.length === 0 && !saves?.unavailable && (
            <div className="mc-sv-empty"><strong>{empty[0]}</strong>{empty[1]}</div>
          )}
          {rows.map((s) => {
            const pending = s.remind_at && !s.reminded_at
            const isDue = pending && new Date(s.remind_at).getTime() <= now
            return (
              <div className="mc-sv-item" key={s.id} data-save-id={s.id}>
                <button type="button" className="mc-sv-main" onClick={() => { onOpenMessage?.(s); onClose?.() }} aria-label={`Open message from ${whoOf(s)}`}>
                  <div className="mc-sv-who">{whoOf(s)}</div>
                  <div className="mc-sv-text">{snippetOf(s)}</div>
                  <div className="mc-sv-meta">
                    {s.starred && <span className="mc-sv-chip mc-sv-chip--star"><IconStar size={12} filled /> Starred</span>}
                    {pending && <span className={`mc-sv-chip${isDue ? ' mc-sv-chip--due' : ''}`}><IconBell size={12} /> {isDue ? 'Due now' : formatWhen(s.remind_at)}</span>}
                    {s.remind_at && s.reminded_at && <span className="mc-sv-chip">Reminded</span>}
                  </div>
                </button>
                <button type="button" className="mc-sv-del" onClick={() => saves.remove(s).catch(() => {})} aria-label="Remove from saved" title="Remove"><IconX size={15} /></button>
              </div>
            )
          })}
        </div>
      </div>
    </div>,
    document.body
  )
}

export function ReminderToast({ due, onOpen, onDismiss }) {
  if (!due || due.length === 0) return null
  const first = due[0]
  return createPortal(
    <div className="mc-rt" role="alert" data-reminder-id={first.id}>
      <div className="mc-rt-body">
        <div className="mc-rt-title">Reminder{due.length > 1 ? ` · ${due.length} due` : ''}</div>
        <div className="mc-rt-text">{snippetOf(first)}</div>
      </div>
      <button type="button" className="mc-rt-btn" onClick={() => { onOpen?.(first); onDismiss?.(first) }}>Open</button>
      <button type="button" className="mc-rt-btn mc-rt-btn--ghost" onClick={() => onDismiss?.(first)}>Dismiss</button>
    </div>,
    document.body
  )
}

export default SavedMessagesSheet
