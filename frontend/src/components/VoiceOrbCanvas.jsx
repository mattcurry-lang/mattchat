// src/components/VoiceOrbCanvas.jsx
// The voice graphic: a glowing orb that moves with your actual voice.
//
//   listening   a ring of live frequency bars + flowing ribbons inside the orb, driven
//               by the microphone (the orb swells and brightens while you speak)
//   requesting  a soft "waiting for permission" ping
//   processing  the orb breathes while three light arcs orbit it ("thinking")
//   error       one quick shake, tinted rose
//   idle        a calm, slowly breathing orb
//
// Colours come from your command bar (purple, lavender, pink, mint) plus the Curry
// orb's state colours (cyan = listening, amber = thinking, rose = problem).
//
// It reads the mic through getLevels()/getVolume() inside its own animation loop,
// so React never re-renders 60 times a second. With "reduce motion" turned on in
// the device settings it draws calm still frames instead of animating.

import React, { useEffect, useRef } from 'react'

const PALETTE = {
  listening:  ['#67E8F9', '#6c63ff', '#f093fb'],
  requesting: ['#a78bfa', '#6c63ff', '#a78bfa'],
  processing: ['#FBBF24', '#f093fb', '#6c63ff'],
  error:      ['#FB7185', '#FB7185', '#a78bfa'],
  idle:       ['#8B7CFF', '#6c63ff', '#a78bfa'],
}

const BARS = 64
const lerp = (a, b, t) => a + (b - a) * t
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))
const mix = (c1, c2, t) => {
  const a = hex(c1); const b = hex(c2)
  return `rgb(${Math.round(lerp(a[0], b[0], t))},${Math.round(lerp(a[1], b[1], t))},${Math.round(lerp(a[2], b[2], t))})`
}
const rgba = (h, a) => { const [r, g, b] = hex(h); return `rgba(${r},${g},${b},${a})` }
// colour around the ring: stop 0 -> 1 -> 2 -> 0, seamless
const ringColor = (pal, u) => {
  const s = u * 3
  const i = Math.floor(s) % 3
  return mix(pal[i], pal[(i + 1) % 3], s - Math.floor(s))
}

export default function VoiceOrbCanvas({ state = 'idle', speaking = false, getLevels, getVolume, size = 200, reducedMotion }) {
  const canvasRef = useRef(null)
  const live = useRef({})
  live.current = { state, speaking, getLevels, getVolume }

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas && canvas.getContext && canvas.getContext('2d')
    if (!ctx) return undefined

    const dpr = Math.min(2, window.devicePixelRatio || 1)
    canvas.width = Math.round(size * dpr)
    canvas.height = Math.round(size * dpr)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    const reduce = reducedMotion != null ? reducedMotion
      : (typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches)

    const bars = new Float32Array(BARS)
    let vol = 0
    let raf = null
    let lastState = live.current.state
    let stateAt = performance.now()
    const t0 = performance.now()

    function draw(now) {
      const { state: st, speaking: talking, getLevels: gl, getVolume: gv } = live.current
      if (st !== lastState) { lastState = st; stateAt = now }
      const t = (now - t0) / 1000
      const pal = PALETTE[st] || PALETTE.idle
      const c = size / 2
      const R = size * 0.25

      // smoothed loudness 0..1 (calm when not listening)
      const targetVol = st === 'listening' && gv ? gv() : 0
      vol += (targetVol - vol) * 0.25
      const v = reduce ? 0.1 : vol

      ctx.clearRect(0, 0, size, size)
      ctx.save()
      if (st === 'error' && !reduce) {
        const age = (now - stateAt) / 1000
        if (age < 0.5) ctx.translate(Math.sin(age * 55) * 3.2 * (1 - age / 0.5), 0)
      }

      // 1) soft glow behind everything
      const glowR = R * (2.3 + v * 0.9)
      const glow = ctx.createRadialGradient(c, c, R * 0.4, c, c, glowR)
      glow.addColorStop(0, rgba(pal[0], 0.30 + v * 0.35 + (talking ? 0.1 : 0)))
      glow.addColorStop(0.55, rgba(pal[1], 0.12 + v * 0.18))
      glow.addColorStop(1, rgba(pal[1], 0))
      ctx.fillStyle = glow
      ctx.fillRect(0, 0, size, size)

      // 2) state-specific ring
      if (st === 'listening') {
        const lv = gl ? gl() : null
        for (let i = 0; i < BARS; i++) {
          // mirror left/right; low voice frequencies sit at the top and bottom of the ring
          const k = Math.min(i, BARS - i)
          let target = 0.05
          if (lv && !reduce) target = (lv[1 + Math.floor((k / (BARS / 2)) * 38)] || 0) / 255
          target = Math.min(1, target * (talking ? 1.55 : 1.0))
          bars[i] += (target - bars[i]) * 0.38
          const a = (i / BARS) * Math.PI * 2 - Math.PI / 2 + t * 0.12
          const r0 = R * 1.34
          const len = 3 + bars[i] * size * (talking ? 0.15 : 0.1)
          ctx.strokeStyle = ringColor(pal, i / BARS)
          ctx.lineWidth = talking ? 3 : 2.4
          ctx.lineCap = 'round'
          ctx.globalAlpha = 0.55 + bars[i] * 0.45
          ctx.beginPath()
          ctx.moveTo(c + Math.cos(a) * r0, c + Math.sin(a) * r0)
          ctx.lineTo(c + Math.cos(a) * (r0 + len), c + Math.sin(a) * (r0 + len))
          ctx.stroke()
        }
        ctx.globalAlpha = 1
      } else if (st === 'processing') {
        for (let k = 0; k < 3; k++) {
          const a0 = t * 3.2 + (k * Math.PI * 2) / 3
          ctx.strokeStyle = mix(pal[k % 3], pal[(k + 1) % 3], 0.5)
          ctx.lineWidth = 4
          ctx.lineCap = 'round'
          ctx.globalAlpha = 0.95
          ctx.beginPath()
          ctx.arc(c, c, R * 1.42, a0, a0 + Math.PI / 3.2)
          ctx.stroke()
        }
        ctx.globalAlpha = 1
      } else if (st === 'requesting') {
        const p = reduce ? 0.4 : (t % 1.4) / 1.4
        ctx.strokeStyle = rgba(pal[0], 0.55 * (1 - p))
        ctx.lineWidth = 2.5
        ctx.beginPath()
        ctx.arc(c, c, R * (1.15 + p * 0.9), 0, Math.PI * 2)
        ctx.stroke()
      }

      // 3) the orb itself, breathing + swelling with your voice
      const breathe = reduce ? 0 : Math.sin(t * (st === 'processing' ? 3 : 1.6)) * 0.025
      const r = R * (1 + v * 0.22 + breathe)
      const core = ctx.createRadialGradient(c - r * 0.35, c - r * 0.4, r * 0.1, c, c, r)
      core.addColorStop(0, mix(pal[0], '#ffffff', 0.35))
      core.addColorStop(0.5, pal[1])
      core.addColorStop(1, pal[2])
      ctx.fillStyle = core
      ctx.beginPath()
      ctx.arc(c, c, r, 0, Math.PI * 2)
      ctx.fill()

      // 4) flowing ribbons inside the orb (Siri-style), taller the louder you are
      if (st === 'listening' || st === 'processing') {
        ctx.save()
        ctx.beginPath()
        ctx.arc(c, c, r * 0.96, 0, Math.PI * 2)
        ctx.clip()
        ctx.globalCompositeOperation = 'lighter'
        const amp = r * (st === 'processing' ? 0.16 : 0.1 + v * 0.55)
        const speed = st === 'processing' ? 3.4 : 2.2 + v * 3
        const waves = [[1, 0, 0.55], [1.7, 1.9, 0.32], [2.4, 3.6, 0.22]]
        waves.forEach(([freq, phase, alpha], idx) => {
          ctx.strokeStyle = `rgba(255,255,255,${alpha})`
          ctx.lineWidth = 2.2 - idx * 0.4
          ctx.beginPath()
          for (let x = -r; x <= r; x += 3) {
            const y = Math.sin((x / r) * Math.PI * 1.4 * freq + t * speed + phase) * amp * (1 - Math.abs(x / r) * 0.55)
            if (x === -r) ctx.moveTo(c + x, c + y); else ctx.lineTo(c + x, c + y)
          }
          ctx.stroke()
        })
        ctx.restore()
      }

      // 5) glass highlight
      ctx.fillStyle = 'rgba(255,255,255,0.28)'
      ctx.beginPath()
      ctx.ellipse(c - r * 0.3, c - r * 0.5, r * 0.34, r * 0.16, -0.5, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()
    }

    function frame(now) {
      if (!document.hidden) draw(now)
      raf = requestAnimationFrame(frame)
    }

    if (reduce) {
      draw(performance.now())                       // one calm still frame
      const redraw = setInterval(() => draw(performance.now()), 400)   // picks up state changes without animating
      return () => clearInterval(redraw)
    }
    raf = requestAnimationFrame(frame)
    return () => { if (raf != null) cancelAnimationFrame(raf) }
  }, [size, reducedMotion])

  return <canvas ref={canvasRef} style={{ width: size, height: size, display: 'block' }} aria-hidden="true" />
}
