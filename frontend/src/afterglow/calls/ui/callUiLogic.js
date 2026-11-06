// afterglow/calls/ui/callUiLogic.js — pure helpers behind the incoming / outgoing call screens.
import { convoHue } from '../../warmth'

export const RING_SECONDS = 45 // how long an incoming call rings before it's declined for you (unchanged from the old screen)

// Presets for "decline and reply" (iOS 26 Live Reply / Samsung quick decline): the caller gets a message instead of silence.
export const QUICK_DECLINE_REPLIES = [
  'Can’t talk right now — what’s up?',
  'I’ll call you back soon',
  'Call me in 10 minutes',
  'In a meeting — text me',
]

/** Each caller gets their own colours, from the same hue system as the rest of Afterglow. */
export const callHue = (seed) => convoHue(String(seed || 'mattchat'))

export const initialOf = (name) => (String(name || '?').trim().charAt(0) || '?').toUpperCase()

export function formatElapsed(sec) {
  const s = Math.max(0, Math.floor(Number(sec) || 0))
  const h = Math.floor(s / 3600); const m = Math.floor((s % 3600) / 60); const r = s % 60
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}` : `${m}:${String(r).padStart(2, '0')}`
}

/** Seconds left before auto-decline, and 0..1 of the ring remaining (for the countdown arc). */
export function ringRemaining(startMs, nowMs, total = RING_SECONDS) {
  const used = Math.max(0, (nowMs - startMs) / 1000)
  const remaining = Math.max(0, total - used)
  return { remaining: Math.ceil(remaining), ratio: Math.max(0, Math.min(1, remaining / total)) }
}

export const kindOf = ({ isZoom, isVideo }) => (isZoom ? 'zoom' : isVideo ? 'video' : 'voice')
export const incomingLabel = (o) => ({ zoom: 'Incoming Zoom call', video: 'Incoming video call', voice: 'Incoming voice call' })[kindOf(o)]
export const subLabel = (o) => ({ zoom: 'Mattchat × Zoom · answering opens Zoom', video: 'Mattchat Video', voice: 'Mattchat Voice' })[kindOf(o)]
export const outgoingLabel = (o, status) => `${({ zoom: 'Zoom call', video: 'Video call', voice: 'Voice call' })[kindOf(o)]} · ${status === 'ringing' ? 'Ringing' : 'Calling'}`

/** "Called 3 times just before this" — urgency, from the call history. */
export function missesLabel(n) {
  const c = Math.max(0, Math.floor(Number(n) || 0))
  if (!c) return ''
  return c === 1 ? 'Called once just before this' : `Called ${c} times just before this`
}

/** What the screen says while you wait for them to pick up. */
export function outgoingHint(elapsedSec) {
  if (elapsedSec < 8) return ''
  if (elapsedSec < 20) return 'Still ringing…'
  return 'No answer yet. Keep waiting, or cancel and leave a voice note.'
}

/** True when a keypress is going into a text field — never let call shortcuts steal those. */
export function isTypingTarget(t) {
  if (!t) return false
  const tag = (t.tagName || '').toUpperCase()
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || !!t.isContentEditable
}

/**
 * Keyboard for an incoming call (desktop). Returns 'answer' | 'decline' | 'message' | 'close' | null.
 * Safety: ignored while you're typing, so Enter in the message box can never answer a call by accident.
 */
export function incomingKey(e, { sheetOpen = false, canReply = false } = {}) {
  if (!e || e.ctrlKey || e.metaKey || e.altKey || e.repeat) return null
  if (isTypingTarget(e.target)) return null
  if (e.key === 'Escape') return sheetOpen ? 'close' : 'decline'
  if (sheetOpen) return null
  if (e.key === 'Enter' || e.key === 'a' || e.key === 'A') return 'answer'
  if (e.key === 'd' || e.key === 'D') return 'decline'
  if ((e.key === 'm' || e.key === 'M') && canReply) return 'message'
  return null
}
export function outgoingKey(e) {
  if (!e || e.ctrlKey || e.metaKey || e.altKey || e.repeat || isTypingTarget(e.target)) return null
  return e.key === 'Escape' ? 'cancel' : null
}

/** Four colour blobs for the living background, all from one hue. */
export function palette(hue) {
  return [
    `hsl(${hue} 85% 52%)`, `hsl(${(hue + 42) % 360} 80% 50%)`, `hsl(${(hue + 318) % 360} 78% 48%)`, `hsl(${(hue + 190) % 360} 70% 42%)`,
  ]
}
