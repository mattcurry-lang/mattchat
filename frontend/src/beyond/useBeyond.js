// src/beyond/useBeyond.js
//
// Owns everything about *getting into and out of* BEYOND:
//   - left-swipe detection on the message list (coexists with swipe-to-reply)
//   - the shared `progress` MotionValue (0 = chat, 1 = BEYOND) that drives
//     both the chat receding and the portal opening
//   - desktop alternative (Alt+B) and the programmatic open/close used by the
//     header button
//   - a history entry so the system Back button closes BEYOND first, not the chat
//   - making the rest of the app inert while BEYOND is open
//
// It deliberately knows nothing about location, movies, etc.

import { useCallback, useEffect, useRef, useState } from 'react'
import { animate, useMotionValue } from 'framer-motion'
import { getSetting } from '../lib/appearanceStore'

const LOCK_PX = 10          // movement before we decide a direction
const H_DOMINANCE = 1.6     // |dx| must beat |dy| by this factor to count as horizontal
const EDGE_GUARD = 24       // ignore touches starting at the right edge (Android back gesture)
const DRAG_SPAN = 0.7       // fraction of screen width that equals full progress
const COMMIT_PROGRESS = 0.3 // release past this => open
const COMMIT_VELOCITY = 0.55 // px/ms leftward flick => open

const prefersReducedMotion = () =>
  !!getSetting('reduceMotion') ||
  (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)

export function useBeyond({ chatRef, scrollerRef, convoKey, enabled }) {
  const progress = useMotionValue(0)
  const [mounted, setMounted] = useState(false)
  const [open, setOpen] = useState(false)

  const openRef = useRef(false)
  const animRef = useRef(null)
  const histPushed = useRef(false)
  const swallowPop = useRef(false)
  const returnFocusRef = useRef(null)

  const run = useCallback((to, velocity = 0, onComplete) => {
    animRef.current?.stop()
    animRef.current = animate(
      progress,
      to,
      prefersReducedMotion()
        ? { duration: 0.14, ease: 'easeOut', onComplete }
        : { type: 'spring', stiffness: 230, damping: 32, mass: 1, velocity, restDelta: 0.001, restSpeed: 0.01, onComplete },
    )
  }, [progress])

  const openBeyond = useCallback((velocity = 0) => {
    if (!enabled || openRef.current) return
    returnFocusRef.current = document.activeElement
    openRef.current = true
    setMounted(true)
    setOpen(true)
    if (!histPushed.current) {
      // keep chatOpen:true so ChatPage's own history effect doesn't push a duplicate
      window.history.pushState({ chatOpen: true, beyond: true }, '')
      histPushed.current = true
    }
    run(1, velocity)
  }, [enabled, run])

  const closeBeyond = useCallback((velocity = 0, { fromPop = false } = {}) => {
    if (!openRef.current) return
    openRef.current = false
    setOpen(false)
    if (histPushed.current && !fromPop) {
      swallowPop.current = true
      window.history.back()
      setTimeout(() => { swallowPop.current = false }, 600) // safety: never swallow a real Back later
    }
    histPushed.current = false
    run(0, velocity, () => {
      if (!openRef.current) setMounted(false)
      const el = returnFocusRef.current
      returnFocusRef.current = null
      if (el && document.contains(el)) el.focus?.({ preventScroll: true })
    })
  }, [run])

  // ChatPage's popstate handler asks us first. Returns true if the pop was ours.
  const consumePop = useCallback(() => {
    if (swallowPop.current) { swallowPop.current = false; return true }
    if (openRef.current) { closeBeyond(0, { fromPop: true }); return true }
    return false
  }, [closeBeyond])

  // ── Left-swipe on the message list ───────────────────────────────────────
  useEffect(() => {
    const el = scrollerRef?.current
    if (!el || !enabled) return undefined

    const prevTouchAction = el.style.touchAction
    const prevOverscroll = el.style.overscrollBehaviorX
    // Vertical scrolling stays native; horizontal moves are delivered to us
    // instead of being claimed by the browser.
    el.style.touchAction = 'pan-y'
    el.style.overscrollBehaviorX = 'none'

    let st = null
    const width = () => window.innerWidth

    const end = (commit) => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onCancel)
      const s = st
      st = null
      if (!s || s.mode !== 'drag') return
      if (commit) {
        openBeyond((s.v * 1000) / (width() * DRAG_SPAN))
      } else {
        run(0, 0, () => { if (!openRef.current) setMounted(false) })
      }
    }

    function onMove(e) {
      if (!st || e.pointerId !== st.id) return
      const dx = e.clientX - st.x
      const dy = e.clientY - st.y

      if (st.mode === 'pending') {
        if (Math.abs(dx) < LOCK_PX && Math.abs(dy) < LOCK_PX) return
        if (dx < 0 && Math.abs(dx) > Math.abs(dy) * H_DOMINANCE) {
          st.mode = 'drag'
          animRef.current?.stop()
          setMounted(true)
        } else {
          st.mode = 'ignore' // vertical scroll, or a rightward (reply) swipe
          end(false)
          return
        }
      }

      const now = performance.now()
      const dt = Math.max(1, now - st.lastT)
      st.v = 0.8 * ((st.lastX - e.clientX) / dt) + 0.2 * st.v // leftward px/ms, smoothed
      st.lastX = e.clientX
      st.lastT = now

      progress.set(Math.min(1, Math.max(0, -dx / (width() * DRAG_SPAN))))
    }

    function onUp() {
      if (!st) return
      const p = progress.get()
      end(p > COMMIT_PROGRESS || st.v > COMMIT_VELOCITY)
    }
    function onCancel() { end(false) }

    function onDown(e) {
      if (openRef.current || !e.isPrimary) return
      if (e.pointerType === 'mouse') return          // desktop uses the button / Alt+B
      if (e.clientX > width() - EDGE_GUARD) return
      const t = performance.now()
      st = { id: e.pointerId, x: e.clientX, y: e.clientY, lastX: e.clientX, lastT: t, v: 0, mode: 'pending' }
      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', onUp)
      window.addEventListener('pointercancel', onCancel)
    }

    el.addEventListener('pointerdown', onDown)
    return () => {
      el.removeEventListener('pointerdown', onDown)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onCancel)
      el.style.touchAction = prevTouchAction
      el.style.overscrollBehaviorX = prevOverscroll
    }
  }, [scrollerRef, enabled, convoKey, openBeyond, progress, run])

  // ── Desktop alternative: Alt+B toggles ──────────────────────────────────
  useEffect(() => {
    if (!enabled) return undefined
    const onKey = (e) => {
      if (e.altKey && !e.ctrlKey && !e.metaKey && e.code === 'KeyB') {
        e.preventDefault()
        if (openRef.current) closeBeyond(); else openBeyond()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [enabled, openBeyond, closeBeyond])

  // ── The chat recedes as progress grows (imperative: no re-render per frame) ─
  useEffect(() => {
    const el = chatRef?.current
    if (!el) return undefined
    const apply = (p) => {
      if (p <= 0.001) {
        el.style.transform = ''
        el.style.opacity = ''
        el.style.willChange = ''
        return
      }
      el.style.willChange = 'transform, opacity'
      el.style.transformOrigin = 'left center'
      el.style.transform = `translate3d(${-p * 22}%,0,0) scale(${1 - p * 0.06})`
      el.style.opacity = String(1 - p * 0.85)
    }
    apply(progress.get())
    const off = progress.on('change', apply)
    return () => { off(); apply(0) }
  }, [chatRef, progress, convoKey])

  // ── Everything behind BEYOND is inert (keyboard + screen readers) ───────
  useEffect(() => {
    const app = chatRef?.current?.closest('.app')
    if (!app) return undefined
    if (open) app.setAttribute('inert', ''); else app.removeAttribute('inert')
    return () => app.removeAttribute('inert')
  }, [open, chatRef, convoKey])

  // Switching/closing the conversation always resets BEYOND.
  useEffect(() => {
    animRef.current?.stop()
    progress.set(0)
    openRef.current = false
    histPushed.current = false
    setOpen(false)
    setMounted(false)
  }, [convoKey, progress])

  return { progress, mounted, open, openBeyond, closeBeyond, consumePop }
}
