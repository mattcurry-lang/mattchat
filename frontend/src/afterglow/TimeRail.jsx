import React, { useEffect, useRef, useState, useCallback } from 'react'
import './afterglow-chat.css'

const THUMB = 28

/**
 * The time rail: a thin edge control that replaces hunting for date dividers.
 * It appears while you scroll (or when you hover the right edge), shows where
 * you are in the conversation, and lets you drag to travel through time with a
 * floating date label. Day boundaries are marked as small ticks.
 *
 * It lives inside the scrolling .messages element as a zero-height sticky
 * anchor, so it needs no changes to the surrounding layout. It only appears in
 * conversations long enough to need it (about 1.5 screens or more).
 */
export default function TimeRail({ scrollerRef, version }) {
  const [s, setS] = useState({ eligible: false, ratio: 0, label: '', marks: [], h: 0 })
  const [visible, setVisible] = useState(false)
  const [dragging, setDragging] = useState(false)
  const railRef = useRef(null)
  const hideTimer = useRef(null)
  const hovering = useRef(false)
  const draggingRef = useRef(false)

  const poke = useCallback(() => {
    setVisible(true)
    clearTimeout(hideTimer.current)
    hideTimer.current = setTimeout(() => {
      if (!hovering.current && !draggingRef.current) setVisible(false)
    }, 1400)
  }, [])

  const measure = useCallback(() => {
    const el = scrollerRef.current
    if (!el) return
    const max = el.scrollHeight - el.clientHeight
    const eligible = max > el.clientHeight * 1.5
    const top = el.getBoundingClientRect().top
    const dividers = [...el.querySelectorAll('.date-divider[data-ts]')].map((d) => ({
      y: d.getBoundingClientRect().top - top + el.scrollTop,
      label: d.textContent.trim(),
    }))
    const marks = max > 0 ? dividers.map((d) => ({ pos: Math.min(1, Math.max(0, d.y / max)) })) : []
    let label = dividers[0]?.label || ''
    for (const d of dividers) if (d.y <= el.scrollTop + 48) label = d.label
    setS({ eligible, ratio: max > 0 ? el.scrollTop / max : 0, label, marks, h: el.clientHeight })
  }, [scrollerRef])

  useEffect(() => {
    const el = scrollerRef.current
    if (!el) return undefined
    let raf = 0
    const onScroll = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => { measure(); poke() })
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => measure()) : null
    ro?.observe(el)
    return () => {
      cancelAnimationFrame(raf)
      clearTimeout(hideTimer.current)
      el.removeEventListener('scroll', onScroll)
      ro?.disconnect()
    }
  }, [scrollerRef, measure, poke])

  useEffect(() => { measure() }, [version, measure])

  const scrollToY = (clientY) => {
    const el = scrollerRef.current
    const rail = railRef.current
    if (!el || !rail) return
    const r = rail.getBoundingClientRect()
    const usable = Math.max(1, r.height - THUMB)
    const ratio = Math.min(1, Math.max(0, (clientY - r.top - THUMB / 2) / usable))
    el.scrollTop = ratio * (el.scrollHeight - el.clientHeight)
  }

  if (!s.eligible) return null
  const shown = visible || dragging
  const y = (r) => `calc(${r} * (100% - ${THUMB}px))`

  return (
    <div className="ag-rail-anchor">
      {/* a narrow hot zone in the empty gutter reveals the rail on hover (desktop) */}
      <div
        className="ag-rail-hot"
        style={{ height: s.h }}
        onPointerEnter={(e) => { if (e.pointerType === 'mouse') { hovering.current = true; setVisible(true) } }}
      />
      <div
        ref={railRef}
        className={`ag-rail${shown ? ' show' : ''}${dragging ? ' drag' : ''}`}
        style={{ height: s.h }}
        onPointerEnter={(e) => { if (e.pointerType === 'mouse') hovering.current = true }}
        onPointerLeave={() => { hovering.current = false; poke() }}
        onPointerDown={(e) => {
          if (!shown) return
          e.currentTarget.setPointerCapture?.(e.pointerId)
          draggingRef.current = true
          setDragging(true)
          scrollToY(e.clientY)
          e.preventDefault()
        }}
        onPointerMove={(e) => { if (draggingRef.current) scrollToY(e.clientY) }}
        onPointerUp={() => { draggingRef.current = false; setDragging(false); poke() }}
        onPointerCancel={() => { draggingRef.current = false; setDragging(false); poke() }}
      >
        <div className="ag-rail-line" />
        {s.marks.map((m, i) => (
          <span key={i} className="ag-rail-tick" style={{ top: `calc(${m.pos} * (100% - ${THUMB}px) + ${THUMB / 2}px)` }} />
        ))}
        <div className="ag-rail-thumb" style={{ top: y(s.ratio), height: THUMB }}>
          {s.label && <span className="ag-rail-label">{s.label}</span>}
        </div>
      </div>
    </div>
  )
}
