import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { callCurryAI } from './CurryAI'
import { canDeleteForEveryone } from '../lib/supabase'
import { canEditMessage, editMessage, editMinutesLeft, getMessageReceipts, getMyReactions, toggleMessageReaction } from '../lib/messageActions'
import { detectSmartActions, formatWhen, formatClock, reminderPresets, suggestReminderTime } from '../lib/smartActions'
import { buildPack, searchEntries } from './emojiSearch'
import * as packData from './emojiPackData'
import { useIsMobile } from '../hooks/useIsMobile'
import { Z } from '../lib/zLayers'
import {
  IconWand, IconList, IconGlobe, IconHelpCircle, IconReply, IconPin, IconForward, IconCopy, IconTrash, IconX,
  IconHourglass, IconStar, IconBell, IconPencil, IconShare2, IconChevronLeft, IconChevronRight, IconPlus, IconSparkle, IconCheck,
} from './Icons'

// The menu that opens on a message (long-press on a phone, right-click on desktop).
//
//   1. an emoji row (your recent ones first, "+" opens every emoji with search)
//   2. quick tiles: Reply / Forward / Copy / Pin
//   3. Star, Remind me, Edit (your own, 15 minutes), Message info (your own), Share
//   4. Smart actions - only when the message holds something actionable (a link, phone number, email, a code)
//   5. Ask Curry: Rewrite / Summarize / Translate (any language) / Explain / Suggest reply
//   6. Delete
// On a phone it is a bottom sheet; on desktop a popover that always stays on screen.
//
// Usage is unchanged: wrap a bubble's press handlers with useMessageLongPress, render ONE <MessageActionsMenu/> per chat
// screen and pass the targeted message in. New OPTIONAL prop: `saves` (the object from useMessageSaves) switches on
// Star / Remind me. Everything else works exactly as before.

const AI_ACTIONS = [
  { id: 'rewrite',   icon: IconWand,       label: 'Rewrite',       prompt: (t) => `Rewrite this message to sound more polished, keeping the same meaning and language. Return ONLY the rewritten message, nothing else:\n\n"${t}"`, canUse: true },
  { id: 'summarize', icon: IconList,       label: 'Summarize',     prompt: (t) => `Summarize this message in one short sentence. Return ONLY the summary:\n\n"${t}"` },
  { id: 'translate', icon: IconGlobe,      label: 'Translate…',    prompt: (t, lang) => `Translate this message to ${lang}. If it is already in ${lang}, translate it to English instead. Return ONLY the translation:\n\n"${t}"` },
  { id: 'explain',   icon: IconHelpCircle, label: 'Explain',       prompt: (t) => `Explain what this message means / is referring to, briefly and plainly. Return ONLY the explanation:\n\n"${t}"` },
  { id: 'reply',     icon: IconReply,      label: 'Suggest reply', prompt: (t) => `Suggest one short, natural reply to this message. Return ONLY the reply text, nothing else:\n\n"${t}"`, canUse: true },
]

export const TRANSLATE_LANGS = [
  ['English', 'English'], ['Kiswahili', 'Swahili'], ['Français', 'French'], ['Español', 'Spanish'], ['العربية', 'Arabic'],
  ['Português', 'Portuguese'], ['Deutsch', 'German'], ['中文', 'Chinese'], ['हिन्दी', 'Hindi'],
]
const DEFAULT_REACTIONS = ['❤️', '😂', '😮', '😢', '🙏', '👍']
const RECENT_KEY = 'mattchat:recent_reactions'
const LANG_KEY = 'mattchat:translate_lang'

const readLS = (k, fb) => { try { return JSON.parse(localStorage.getItem(k)) ?? fb } catch { return fb } }
const writeLS = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)) } catch { /* private mode */ } }

const InfoIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 11v5" /><circle cx="12" cy="7.8" r=".6" fill="currentColor" /></svg>
)
const ExternalIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M7 17 17 7" /><path d="M8 7h9v9" /></svg>
)

/** Where to put the popover so it never leaves the screen (flips left/up when it would). Pure, tested. */
export function placeMenu({ x, y, w, h, vw, vh, margin = 8 }) {
  let left = x; let top = y
  if (left + w + margin > vw) left = x - w          // no room to the right: open to the left of the pointer
  if (top + h + margin > vh) top = y - h            // no room below: open above it
  // then hold it inside the screen (a menu bigger than the screen still starts on screen)
  left = Math.max(margin, Math.min(left, vw - w - margin))
  top = Math.max(margin, Math.min(top, vh - h - margin))
  return { left, top }
}

async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true } catch { /* fall back below */ }
  try {
    const ta = document.createElement('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0'
    document.body.appendChild(ta); ta.select(); const ok = document.execCommand('copy'); ta.remove(); return ok
  } catch { return false }
}

const CSS = `
.mc-mam-back{position:fixed; inset:0; z-index:${Z.contextMenu}; background:rgba(6,5,14,.5); -webkit-backdrop-filter:blur(3px); backdrop-filter:blur(3px); animation:backdropFadeIn .18s ease-out}
.mc-mam{position:fixed; z-index:${Z.contextMenu}; width:min(304px,calc(100vw - 16px)); max-height:min(620px,calc(100vh - 16px)); overflow-y:auto; overscroll-behavior:contain; scrollbar-width:thin; background:rgba(24,24,38,.98); -webkit-backdrop-filter:blur(18px); backdrop-filter:blur(18px); border:1px solid rgba(167,139,250,.25); border-radius:18px; box-shadow:0 18px 48px -8px rgba(0,0,0,.65); color:#e8e8f2; font-family:inherit; animation:menuPop .16s cubic-bezier(.34,1.56,.64,1)}
.mc-mam--sheet{left:0!important; right:0; bottom:0; top:auto!important; width:100%; max-height:86vh; border-radius:22px 22px 0 0; padding-bottom:env(safe-area-inset-bottom,0px); animation:sheetSlideUp .26s cubic-bezier(.2,.9,.3,1)}
.mc-mam-grab{width:38px; height:4px; border-radius:2px; background:rgba(255,255,255,.2); margin:8px auto 2px}
.mc-mam-react{display:flex; justify-content:space-between; gap:2px; padding:10px 10px 6px}
.mc-mam-emoji{width:40px; height:40px; flex:none; border:0; border-radius:50%; display:grid; place-items:center; font-size:23px; line-height:1; background:transparent; cursor:pointer; transition:transform .12s ease, background .15s ease}
.mc-mam-emoji:hover{background:rgba(255,255,255,.1); transform:scale(1.18)}
.mc-mam-emoji[aria-pressed="true"]{background:rgba(167,139,250,.3); box-shadow:inset 0 0 0 1.5px rgba(167,139,250,.8)}
.mc-mam-emoji--more{font-size:18px; color:rgba(255,255,255,.8); background:rgba(255,255,255,.08)}
.mc-mam-preview{display:flex; gap:8px; align-items:baseline; margin:2px 12px 6px; padding:7px 10px; border-radius:10px; background:rgba(255,255,255,.05); font-size:12px; color:rgba(232,232,242,.6); min-width:0}
.mc-mam-preview b{color:#c4b5fd; font-weight:700; flex:none}
.mc-mam-preview span{white-space:nowrap; overflow:hidden; text-overflow:ellipsis}
.mc-mam-tiles{display:grid; grid-auto-flow:column; grid-auto-columns:1fr; gap:6px; padding:4px 10px 8px}
.mc-mam-tile{display:flex; flex-direction:column; align-items:center; justify-content:center; gap:5px; height:58px; border:0; border-radius:13px; background:rgba(255,255,255,.06); color:inherit; font:inherit; font-size:11.5px; font-weight:650; cursor:pointer; transition:background .15s ease, transform .1s ease}
.mc-mam-tile:hover{background:rgba(255,255,255,.12)}
.mc-mam-tile:active{transform:scale(.96)}
.mc-mam-sep{height:1px; margin:4px 12px; background:rgba(255,255,255,.08)}
.mc-mam-head{padding:8px 16px 2px; font-size:11px; font-weight:800; letter-spacing:.06em; text-transform:uppercase; color:rgba(232,232,242,.45)}
.mc-mam-item{display:flex; align-items:center; gap:12px; width:calc(100% - 12px); margin:1px 6px; padding:10px 10px; border:0; border-radius:11px; background:none; color:inherit; font:inherit; font-size:14px; font-weight:560; text-align:left; cursor:pointer; transition:background .12s ease}
.mc-mam-item:hover:not(:disabled), .mc-mam-item:focus-visible{background:rgba(255,255,255,.08); outline:none}
.mc-mam-item:disabled{opacity:.5; cursor:default}
.mc-mam-item .ico{display:grid; place-items:center; width:20px; flex:none; color:rgba(232,232,242,.75)}
.mc-mam-item .hint{margin-left:auto; padding-left:8px; font-size:12px; font-weight:600; color:rgba(232,232,242,.5); white-space:nowrap}
.mc-mam-item--danger{color:#f87171} .mc-mam-item--danger .ico{color:#f87171}
.mc-mam-item--accent .ico{color:#a78bfa}
.mc-mam-item--gold .ico{color:#fbbf24}
.mc-mam-chips{display:flex; flex-wrap:wrap; gap:6px; padding:4px 12px 10px}
.mc-mam-chip{display:inline-flex; align-items:center; gap:6px; border:0; border-radius:999px; padding:7px 12px; background:rgba(167,139,250,.14); color:#ddd6fe; font:inherit; font-size:12.5px; font-weight:650; cursor:pointer; transition:background .15s ease}
.mc-mam-chip:hover:not(:disabled){background:rgba(167,139,250,.26)}
.mc-mam-chip:disabled{opacity:.55; cursor:default}
.mc-mam-sub{padding:6px 6px 10px}
.mc-mam-subhead{display:flex; align-items:center; gap:6px; padding:6px 6px 6px 8px}
.mc-mam-back-btn{display:grid; place-items:center; width:32px; height:32px; border:0; border-radius:50%; background:rgba(255,255,255,.08); color:inherit; cursor:pointer}
.mc-mam-subtitle{font-size:15px; font-weight:800; letter-spacing:-.01em}
.mc-mam-note{padding:4px 14px 6px; font-size:12px; line-height:1.45; color:rgba(232,232,242,.5)}
.mc-mam-error{margin:8px 10px 2px; padding:9px 12px; border-radius:11px; background:rgba(248,113,113,.12); color:#fca5a5; font-size:12.5px; line-height:1.4}
.mc-mam-ok{margin:6px 14px; padding:9px 12px; border-radius:11px; background:rgba(74,222,128,.12); color:#86efac; font-size:13px; font-weight:650}
.mc-mam-text{margin:2px 12px 8px; padding:10px 12px; border-radius:12px; background:rgba(255,255,255,.05); font-size:14px; line-height:1.5; max-height:180px; overflow-y:auto; white-space:pre-wrap; word-break:break-word}
.mc-mam-textarea{display:block; width:calc(100% - 24px); margin:4px 12px 8px; min-height:92px; max-height:220px; resize:vertical; padding:10px 12px; border-radius:12px; border:1px solid rgba(167,139,250,.35); background:rgba(255,255,255,.05); color:#fff; font:inherit; font-size:14.5px; line-height:1.45; outline:none}
.mc-mam-textarea:focus{border-color:#a78bfa}
.mc-mam-row{display:flex; gap:8px; padding:2px 12px 8px}
.mc-mam-btn{flex:1; border:0; border-radius:11px; padding:10px 12px; font:inherit; font-size:13.5px; font-weight:700; cursor:pointer; color:#fff; background:#6c63ff}
.mc-mam-btn:disabled{opacity:.45; cursor:default}
.mc-mam-btn--ghost{background:rgba(255,255,255,.1)}
.mc-mam-input{flex:1; min-width:0; padding:9px 10px; border-radius:10px; border:1px solid rgba(255,255,255,.18); background:rgba(255,255,255,.06); color:#fff; font:inherit; font-size:13px; color-scheme:dark}
.mc-mam-search{display:block; width:calc(100% - 24px); margin:4px 12px 8px; padding:9px 12px; border-radius:10px; border:1px solid rgba(255,255,255,.18); background:rgba(255,255,255,.06); color:#fff; font:inherit; font-size:14px; outline:none}
.mc-mam-grid{display:grid; grid-template-columns:repeat(7,1fr); gap:2px; padding:0 8px 10px; max-height:240px; overflow-y:auto}
.mc-mam-grid button{border:0; background:none; border-radius:9px; padding:5px 0; font-size:22px; cursor:pointer; line-height:1}
.mc-mam-grid button:hover{background:rgba(255,255,255,.12)}
.mc-mam-reader{display:flex; justify-content:space-between; gap:10px; padding:7px 14px; font-size:13.5px}
.mc-mam-reader span:last-child{color:rgba(232,232,242,.55); white-space:nowrap}
@media (prefers-reduced-motion:reduce){ .mc-mam,.mc-mam-back{animation:none} .mc-mam-emoji,.mc-mam-tile{transition:none} }
`
let styled = false
function ensureStyles() {
  if (styled || typeof document === 'undefined') return
  styled = true
  const el = document.createElement('style'); el.setAttribute('data-mc-mam', ''); el.textContent = CSS; document.head.appendChild(el)
}
ensureStyles()

export function useMessageLongPress(onOpen) {
  const timerRef = useRef(null)
  const firedRef = useRef(false)

  const bind = (message) => ({
    onTouchStart: (e) => {
      firedRef.current = false
      const touch = e.touches[0]
      timerRef.current = setTimeout(() => {
        firedRef.current = true
        onOpen(message, touch.clientX, touch.clientY)
      }, 450)
    },
    onTouchEnd: () => clearTimeout(timerRef.current),
    onTouchMove: () => clearTimeout(timerRef.current),
    onContextMenu: (e) => {
      e.preventDefault()
      onOpen(message, e.clientX, e.clientY)
    },
  })

  return bind
}

// Small building blocks. They live OUTSIDE the menu component on purpose: if they were created inside it, every
// keystroke would rebuild them and the search box would lose focus after each letter.
function Item({ icon, label, hint, onClick, tone, disabled, id }) {
  return (
    <button type="button" role="menuitem" data-nav data-id={id} className={`mc-mam-item${tone ? ` mc-mam-item--${tone}` : ''}`} onClick={onClick} disabled={disabled}>
      <span className="ico">{icon}</span><span>{label}</span>{hint && <span className="hint">{hint}</span>}
    </button>
  )
}
function Sub({ title, onBack, children }) {
  return (
    <div className="mc-mam-sub">
      <div className="mc-mam-subhead">
        <button type="button" data-nav className="mc-mam-back-btn" onClick={onBack} aria-label="Back"><IconChevronLeft size={16} /></button>
        <div className="mc-mam-subtitle">{title}</div>
      </div>
      {children}
    </div>
  )
}
function ErrorLine({ text }) { return text ? <div className="mc-mam-error" role="alert">{text}</div> : null }

export default function MessageActionsMenu({
  session, message, position, currentUserId, onClose,
  onInsertReply, onPin, onCopy,
  onReply, onForward, onDeleteForMe, onDeleteForEveryone,
  saves, onEdited,
}) {
  const isSheet = useIsMobile()
  const menuRef = useRef(null)
  const openedAt = useRef(0)
  const [view, setView] = useState('main')       // main | emoji | remind | edit | info | translate | result | delete
  const [busy, setBusy] = useState(null)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [flash, setFlash] = useState('')          // a short success line ("Reminder set…")
  const [copied, setCopied] = useState(false)
  const [mine, setMine] = useState(() => new Set())
  const [recent, setRecent] = useState(() => readLS(RECENT_KEY, []))
  const [receipts, setReceipts] = useState(null)
  const [draft, setDraft] = useState('')
  const [emojiQuery, setEmojiQuery] = useState('')
  const [customWhen, setCustomWhen] = useState('')
  const [pos, setPos] = useState(null)
  const pack = useMemo(() => buildPack(packData), [])

  const messageId = message?.id
  // a fresh message = a fresh menu
  useEffect(() => {
    setView('main'); setResult(null); setError(''); setFlash(''); setCopied(false); setReceipts(null); setEmojiQuery(''); setCustomWhen('')
    setDraft(message?.content || '')
    openedAt.current = Date.now()
    if (message && isSheet && typeof navigator !== 'undefined' && navigator.vibrate) { try { navigator.vibrate(8) } catch { /* ignore */ } }
  }, [messageId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {                                 // which emoji have I already used on this message?
    let alive = true
    setMine(new Set())
    if (messageId && currentUserId) getMyReactions(messageId, currentUserId).then((s) => { if (alive) setMine(s) }).catch(() => {})
    return () => { alive = false }
  }, [messageId, currentUserId])

  // desktop: click outside closes (right-clicks pass through, so another message can be opened directly)
  useEffect(() => {
    if (!message || isSheet) return undefined
    const handler = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) onClose() }
    document.addEventListener('mousedown', handler)
    window.addEventListener('resize', onClose)
    return () => { document.removeEventListener('mousedown', handler); window.removeEventListener('resize', onClose) }
  }, [message, isSheet, onClose])

  // place the popover after we know how big it is
  useLayoutEffect(() => {
    if (!message || !position || isSheet || !menuRef.current) return
    const r = menuRef.current.getBoundingClientRect()
    setPos(placeMenu({ x: position.x, y: position.y, w: r.width, h: r.height, vw: window.innerWidth, vh: window.innerHeight }))
  }, [messageId, position?.x, position?.y, view, isSheet, result]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {                                 // keyboard users land on the first action
    if (!message || !menuRef.current) return
    const active = document.activeElement
    if (active && menuRef.current.contains(active) && /^(INPUT|TEXTAREA)$/.test(active.tagName)) return   // the search / edit box already has the cursor
    const first = menuRef.current.querySelector('[data-nav]'); if (first && !isSheet) first.focus({ preventScroll: true })
  }, [messageId, view, isSheet]) // eslint-disable-line react-hooks/exhaustive-deps

  const text = message?.content || ''
  const hasText = text.trim().length > 0
  const isMine = !!message && message.sender_id === currentUserId
  const canDeleteEveryone = isMine && message ? canDeleteForEveryone(message, currentUserId) : false
  const canEdit = !!message && canEditMessage(message, currentUserId)
  const smart = useMemo(() => (hasText ? detectSmartActions(text) : []), [text, hasText])
  const savedRow = saves && message ? saves.byMessage?.get(message.id) : null
  const starred = !!savedRow?.starred
  const reminderAt = saves && message ? saves.reminderFor?.(message.id) : null
  const isTemp = String(messageId || '').startsWith('temp')

  const reactionRow = useMemo(() => {
    const seen = new Set(); const row = []
    for (const e of [...recent, ...DEFAULT_REACTIONS]) { if (!seen.has(e)) { seen.add(e); row.push(e) } if (row.length === 6) break }
    return row
  }, [recent])

  const back = useCallback(() => { setError(''); setFlash(''); setResult(null); setView('main') }, [])
  const attempt = useCallback(async (key, fn) => {
    setBusy(key); setError('')
    try { await fn() } catch (e) { setError(e?.message || 'Something went wrong') }
    setBusy(null)
  }, [])
  const closeSoon = useCallback((ms = 700) => { setTimeout(() => onClose?.(), ms) }, [onClose])

  if (!message || !position) return null

  // ── actions ───────────────────────────────────────────────
  const react = (emoji) => attempt('react', async () => {
    await toggleMessageReaction(message.id, currentUserId, emoji)
    const next = [emoji, ...recent.filter((e) => e !== emoji)].slice(0, 6); setRecent(next); writeLS(RECENT_KEY, next)
    onClose()
  })

  const runAi = (action, lang) => attempt(action.id, async () => {
    setResult(null)
    try {
      const data = await callCurryAI('chat', { message: action.prompt(text, lang) }, session)
      const clean = data.ok ? data.response.replace(/<action>[\s\S]*?<\/action>/g, '').trim() : 'Something went wrong.'
      setResult({ actionId: action.id, text: clean, lang })
    } catch { setResult({ actionId: action.id, text: 'Network error.', lang }) }
    setView('result')
  })

  const doCopy = async () => {
    if (!(await copyText(text))) { setError('Couldn’t copy. Your browser blocked it.'); return }
    setCopied(true); onCopy?.(); closeSoon(650)
  }

  const doShare = () => attempt('share', async () => { await navigator.share({ text }); onClose() }).then(() => {})

  const openSmart = (a) => {
    if (a.kind === 'copy') { copyText(a.value).then((ok) => { if (ok) { setFlash(`Copied ${a.value && a.value.length < 40 ? a.value : ''}`.trim()); closeSoon(650) } else setError('Couldn’t copy.') }); return }
    if (/^https?:/i.test(a.href)) window.open(a.href, '_blank', 'noopener,noreferrer')
    else window.location.href = a.href
    onClose()
  }

  const setRemind = (at) => attempt('remind', async () => {
    if (new Date(at).getTime() < Date.now() + 30000) throw new Error('Pick a time in the future')
    await saves.setReminder(message, at)
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') { try { Notification.requestPermission() } catch { /* ignore */ } }
    setFlash(`Reminder set · ${formatWhen(at)}`); closeSoon(900)
  })

  const saveEdit = () => attempt('edit', async () => {
    const updated = await editMessage(message.id, currentUserId, draft)
    onEdited?.(updated); onClose()
  })

  const openInfo = () => {
    setView('info'); setReceipts(null)
    getMessageReceipts(message.id).then(setReceipts).catch(() => setReceipts([]))
  }

  const onKeyDown = (e) => {
    if (e.key === 'Escape') { e.stopPropagation(); if (view === 'main') onClose(); else back(); return }
    if (['ArrowDown', 'ArrowUp', 'ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(e.key)) {
      if ((e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT') && !['ArrowDown', 'ArrowUp'].includes(e.key)) return
      if (e.target.tagName === 'TEXTAREA') return
      const items = [...menuRef.current.querySelectorAll('[data-nav]:not(:disabled)')]; if (!items.length) return
      e.preventDefault()
      const i = items.indexOf(document.activeElement)
      let n = i
      if (e.key === 'ArrowDown' || e.key === 'ArrowRight') n = i < 0 ? 0 : (i + 1) % items.length
      else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') n = i <= 0 ? items.length - 1 : i - 1
      else if (e.key === 'Home') n = 0
      else n = items.length - 1
      items[n].focus()
    }
  }

  // ── pieces ────────────────────────────────────────────────
  const senderName = isMine ? 'You' : message.profiles?.username || 'Message'
  const sentAt = message.created_at ? formatClock(new Date(message.created_at)) : ''
  const tiles = [
    onReply && { id: 'reply', icon: <IconReply size={18} />, label: 'Reply', run: () => { onReply(); onClose() } },
    onForward && { id: 'forward', icon: <IconForward size={18} />, label: 'Forward', run: () => { onForward(); onClose() } },
    hasText && onCopy !== undefined && { id: 'copy', icon: copied ? <IconCheck size={18} /> : <IconCopy size={18} />, label: copied ? 'Copied' : 'Copy', run: doCopy },
    onPin && { id: 'pin', icon: <IconPin size={18} />, label: 'Pin', run: () => { onPin(); onClose() } },
  ].filter(Boolean)
  const canShare = hasText && typeof navigator !== 'undefined' && typeof navigator.share === 'function'

  const sheetStyle = isSheet ? undefined : { left: pos ? pos.left : position.x, top: pos ? pos.top : position.y, visibility: pos ? 'visible' : 'hidden' }

  const body = (() => {
    if (view === 'emoji') {
      const list = emojiQuery.trim() ? searchEntries(pack.entries, emojiQuery, 70) : (pack.byGroup[0] || []).slice(0, 112)
      return (
        <Sub onBack={back} title="React with any emoji">
          <input className="mc-mam-search" data-nav placeholder="Search emoji…" value={emojiQuery} onChange={(e) => setEmojiQuery(e.target.value)} autoFocus aria-label="Search emoji" />
          <div className="mc-mam-grid" role="group" aria-label="Emoji">
            {list.map((e) => <button type="button" key={e.char} data-nav title={e.label} aria-label={`React with ${e.label}`} onClick={() => react(e.char)}>{e.char}</button>)}
            {list.length === 0 && <div className="mc-mam-note" style={{ gridColumn: '1/-1' }}>No emoji found</div>}
          </div>
          <ErrorLine text={error} />
        </Sub>
      )
    }
    if (view === 'remind') {
      const suggestion = suggestReminderTime(text)
      const presets = reminderPresets()
      return (
        <Sub onBack={back} title="Remind me">
          {flash ? <div className="mc-mam-ok" role="status">{flash}</div> : (
            <>
              {suggestion && <Item id="remind-suggested" tone="accent" icon={<IconSparkle size={16} />} label="From the message" hint={suggestion.label} onClick={() => setRemind(suggestion.at)} disabled={busy === 'remind'} />}
              {presets.map((p) => <Item key={p.id} id={`remind-${p.id}`} icon={<IconBell size={16} />} label={p.label} hint={p.hint} onClick={() => setRemind(p.at)} disabled={busy === 'remind'} />)}
              <div className="mc-mam-row" style={{ paddingTop: 8 }}>
                <input type="datetime-local" className="mc-mam-input" data-nav aria-label="Pick a date and time" value={customWhen} onChange={(e) => setCustomWhen(e.target.value)} />
                <button type="button" className="mc-mam-btn" style={{ flex: '0 0 auto' }} disabled={!customWhen || busy === 'remind'} onClick={() => setRemind(new Date(customWhen))}>Set</button>
              </div>
              {reminderAt && <Item id="remind-clear" tone="danger" icon={<IconX size={16} />} label="Clear reminder" hint={formatWhen(reminderAt)} onClick={() => attempt('remind', async () => { await saves.setReminder(message, null); onClose() })} />}
              <div className="mc-mam-note">Reminders pop up while Mattchat is open. If you were away, they appear when you come back.</div>
            </>
          )}
          <ErrorLine text={error} />
        </Sub>
      )
    }
    if (view === 'edit') {
      const left = editMinutesLeft(message)
      const changed = draft.trim() && draft.trim() !== text
      return (
        <Sub onBack={back} title="Edit message">
          <textarea className="mc-mam-textarea" data-nav value={draft} onChange={(e) => setDraft(e.target.value)} autoFocus aria-label="Edit your message"
            onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && changed) { e.preventDefault(); saveEdit() } }} />
          <div className="mc-mam-note">{left > 0 ? `You can edit for another ${left} min. Everyone will see “edited”.` : 'The 15-minute edit window has closed.'}</div>
          <div className="mc-mam-row">
            <button type="button" className="mc-mam-btn mc-mam-btn--ghost" data-nav onClick={back}>Cancel</button>
            <button type="button" className="mc-mam-btn" data-nav disabled={!changed || busy === 'edit' || left === 0} onClick={saveEdit}>{busy === 'edit' ? 'Saving…' : 'Save'}</button>
          </div>
          <ErrorLine text={error} />
        </Sub>
      )
    }
    if (view === 'info') {
      return (
        <Sub onBack={back} title="Message info">
          <div className="mc-mam-reader"><span>Sent</span><span>{message.created_at ? formatWhen(message.created_at) : '-'}</span></div>
          {message.edited_at && <div className="mc-mam-reader"><span>Edited</span><span>{formatWhen(message.edited_at)}</span></div>}
          <div className="mc-mam-sep" />
          <div className="mc-mam-head" style={{ paddingTop: 4 }}>Seen by</div>
          {receipts === null && <div className="mc-mam-note">Checking…</div>}
          {receipts && receipts.length === 0 && <div className="mc-mam-note">Not seen yet</div>}
          {receipts && receipts.map((r) => <div className="mc-mam-reader" key={r.userId}><span>{r.name}</span><span>{r.readAt ? formatWhen(r.readAt) : 'Seen'}</span></div>)}
        </Sub>
      )
    }
    if (view === 'translate') {
      const last = readLS(LANG_KEY, null)
      const langs = last ? [TRANSLATE_LANGS.find((l) => l[1] === last), ...TRANSLATE_LANGS.filter((l) => l[1] !== last)].filter(Boolean) : TRANSLATE_LANGS
      const action = AI_ACTIONS.find((a) => a.id === 'translate')
      return (
        <Sub onBack={back} title="Translate to…">
          {langs.map(([native, name]) => (
            <Item key={name} id={`lang-${name}`} icon={<IconGlobe size={16} />} label={native} hint={native !== name ? name : (last === name ? 'Last used' : '')} disabled={!!busy}
              onClick={() => { writeLS(LANG_KEY, name); runAi(action, name) }} />
          ))}
          {busy === 'translate' && <div className="mc-mam-note">Translating…</div>}
        </Sub>
      )
    }
    if (view === 'result' && result) {
      const action = AI_ACTIONS.find((a) => a.id === result.actionId)
      return (
        <Sub onBack={back} title={action?.label.replace('…', '') + (result.lang ? ` · ${result.lang}` : '')}>
          <div className="mc-mam-text">{result.text}</div>
          <div className="mc-mam-row">
            <button type="button" className="mc-mam-btn mc-mam-btn--ghost" data-nav onClick={async () => { if (await copyText(result.text)) { setFlash('Copied'); setTimeout(() => setFlash(''), 900) } }}>{flash === 'Copied' ? 'Copied ✓' : 'Copy'}</button>
            {action?.canUse && onInsertReply && <button type="button" className="mc-mam-btn" data-nav onClick={() => { onInsertReply(result.text); onClose() }}>{action.id === 'reply' ? 'Use this reply' : 'Use this'}</button>}
          </div>
        </Sub>
      )
    }
    if (view === 'delete') {
      return (
        <Sub onBack={back} title="Delete this message?">
          {onDeleteForMe && <Item id="delete-me" icon={<IconTrash size={16} />} label="Delete for me" onClick={() => { onDeleteForMe(); onClose() }} />}
          {canDeleteEveryone && onDeleteForEveryone ? (
            <Item id="delete-all" tone="danger" icon={<IconTrash size={16} />} label="Delete for everyone" onClick={() => { onDeleteForEveryone(); onClose() }} />
          ) : isMine && onDeleteForEveryone ? (
            <div className="mc-mam-note">Too old to delete for everyone (12h window passed)</div>
          ) : null}
        </Sub>
      )
    }

    // main
    return (
      <>
        {!isTemp && currentUserId && (
          <div className="mc-mam-react" role="group" aria-label="Reactions">
            {reactionRow.map((e) => <button type="button" key={e} data-nav className="mc-mam-emoji" aria-pressed={mine.has(e)} aria-label={`React with ${e}`} disabled={busy === 'react'} onClick={() => react(e)}>{e}</button>)}
            <button type="button" data-nav className="mc-mam-emoji mc-mam-emoji--more" aria-label="More emoji" onClick={() => setView('emoji')}><IconPlus size={18} /></button>
          </div>
        )}
        {hasText && <div className="mc-mam-preview"><b>{senderName}{sentAt ? ` · ${sentAt}` : ''}</b><span>{text}</span></div>}
        {tiles.length > 0 && (
          <div className="mc-mam-tiles">
            {tiles.map((t) => <button type="button" role="menuitem" key={t.id} data-nav data-id={t.id} className="mc-mam-tile" onClick={t.run}>{t.icon}<span>{t.label}</span></button>)}
          </div>
        )}
        <ErrorLine text={error} />
        {flash && <div className="mc-mam-ok" role="status">{flash}</div>}
        {(saves || canEdit || isMine || canShare) && <div className="mc-mam-sep" />}
        {saves && !isTemp && (
          <>
            <Item id="star" tone={starred ? 'gold' : undefined} icon={<IconStar size={16} filled={starred} />} label={starred ? 'Unstar message' : 'Star message'} disabled={busy === 'star'}
              onClick={() => attempt('star', async () => { await saves.toggleStar(message); onClose() })} />
            <Item id="remind" icon={<IconBell size={16} />} label="Remind me" hint={reminderAt ? formatWhen(reminderAt) : <IconChevronRight size={14} />} onClick={() => setView('remind')} />
          </>
        )}
        {canEdit && <Item id="edit" icon={<IconPencil size={16} />} label="Edit message" hint={`${editMinutesLeft(message)} min left`} onClick={() => setView('edit')} />}
        {isMine && !isTemp && <Item id="info" icon={<InfoIcon size={16} />} label="Message info" onClick={openInfo} />}
        {canShare && <Item id="share" icon={<IconShare2 size={16} />} label="Share…" onClick={doShare} />}

        {smart.length > 0 && (
          <>
            <div className="mc-mam-sep" />
            <div className="mc-mam-head">Smart actions</div>
            {smart.map((a) => (
              <Item key={a.id} id={`smart-${a.id}`} tone="accent" icon={a.kind === 'copy' ? <IconCopy size={16} /> : <ExternalIcon size={16} />} label={a.label} onClick={() => openSmart(a)} />
            ))}
          </>
        )}

        {hasText && (
          <>
            <div className="mc-mam-sep" />
            <div className="mc-mam-head">Ask Curry</div>
            <div className="mc-mam-chips">
              {AI_ACTIONS.map((a) => (
                <button type="button" key={a.id} data-nav data-id={`ai-${a.id}`} className="mc-mam-chip" disabled={!!busy}
                  onClick={() => (a.id === 'translate' ? setView('translate') : runAi(a))}>
                  {busy === a.id ? <><IconHourglass size={13} /> Thinking…</> : <><a.icon size={13} /> {a.label}</>}
                </button>
              ))}
            </div>
          </>
        )}

        {(onDeleteForMe || onDeleteForEveryone) && (
          <>
            <div className="mc-mam-sep" />
            <Item id="delete" tone="danger" icon={<IconTrash size={16} />} label="Delete" onClick={() => setView('delete')} />
          </>
        )}
      </>
    )
  })()

  return createPortal(
    <>
      {isSheet && <div className="mc-mam-back" onClick={() => { if (Date.now() - openedAt.current > 350) onClose() }} role="presentation" />}
      <div ref={menuRef} className={`mc-mam${isSheet ? ' mc-mam--sheet' : ''}`} style={sheetStyle} role="menu" aria-label="Message actions" tabIndex={-1} onKeyDown={onKeyDown}>
        {isSheet && <div className="mc-mam-grab" aria-hidden="true" />}
        {body}
      </div>
    </>,
    document.body
  )
}
