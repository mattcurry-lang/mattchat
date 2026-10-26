import React, { useEffect, useRef } from 'react'

// The animated sky behind the hero: sun and rays, moon and stars, drifting clouds, rain, snow, fog and
// lightning, all on one canvas. It pauses when the tab is hidden or the card is off-screen, draws a single
// still frame for people who prefer reduced motion, and caps the pixel ratio so it stays light on phones.

const rand = (a, b) => a + Math.random() * (b - a)

function makeClouds(n, w, h, dark) {
  return Array.from({ length: n }, () => ({ x: rand(-0.2, 1.1) * w, y: rand(0.05, 0.55) * h, s: rand(36, 74), v: rand(4, 11) * (Math.random() < 0.5 ? 1 : 0.7), a: rand(dark ? 0.35 : 0.3, dark ? 0.62 : 0.55) }))
}
function drawCloud(ctx, x, y, s, tint, alpha) {
  const lobes = [[-0.9, 0.15, 0.55], [-0.35, -0.15, 0.75], [0.25, -0.05, 0.7], [0.8, 0.12, 0.5], [0, 0.25, 0.85]]
  for (const [dx, dy, r] of lobes) {
    const g = ctx.createRadialGradient(x + dx * s, y + dy * s, 0, x + dx * s, y + dy * s, r * s)
    g.addColorStop(0, `rgba(${tint},${alpha})`); g.addColorStop(1, `rgba(${tint},0)`)
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x + dx * s, y + dy * s, r * s, 0, Math.PI * 2); ctx.fill()
  }
}
function glow(ctx, x, y, r, c0, c1 = 'rgba(255,255,255,0)') {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, c0); g.addColorStop(1, c1)
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill()
}

export function makeSim(scene, isDay, windKmh, w, h) {
  const wind = Math.max(-1, Math.min(1, (windKmh || 0) / 40))
  const sim = { t: 0, flash: 0, nextBolt: rand(3, 7), bolt: null, w, h }
  const dark = ['rain', 'heavyrain', 'storm', 'drizzle', 'sleet', 'cloudy'].includes(scene)
  const cloudsN = { clear: isDay ? 1 : 0, partly: 4, cloudy: 7, fog: 2, drizzle: 5, rain: 6, heavyrain: 7, snow: 5, heavysnow: 6, sleet: 6, storm: 8 }[scene] ?? 4
  sim.clouds = makeClouds(cloudsN, w, h, dark)
  sim.cloudTint = dark ? (scene === 'storm' ? '70,78,100' : '150,162,182') : isDay ? '255,255,255' : '170,185,215'
  const dropsN = { drizzle: 40, rain: 85, heavyrain: 150, storm: 150, sleet: 60 }[scene] || 0
  sim.drops = Array.from({ length: dropsN }, () => ({ x: rand(-0.1, 1.1) * w, y: rand(0, h), l: rand(10, scene === 'drizzle' ? 14 : 24), v: rand(scene === 'drizzle' ? 260 : 520, scene === 'drizzle' ? 340 : 760), a: rand(0.25, 0.6) }))
  const flakesN = { snow: 70, heavysnow: 130, sleet: 35 }[scene] || 0
  sim.flakes = Array.from({ length: flakesN }, () => ({ x: rand(0, w), y: rand(0, h), r: rand(1.2, 3.2), v: rand(18, 46), ph: rand(0, 6.28), sway: rand(10, 28) }))
  sim.stars = !isDay && ['clear', 'partly'].includes(scene) ? Array.from({ length: 70 }, () => ({ x: rand(0, w), y: rand(0, h * 0.7), r: rand(0.5, 1.6), ph: rand(0, 6.28), sp: rand(1, 3) })) : []
  sim.fog = scene === 'fog' ? Array.from({ length: 5 }, (_, i) => ({ y: h * (0.22 + i * 0.15), x: rand(0, w), v: rand(6, 16) * (i % 2 ? -1 : 1), a: rand(0.1, 0.22) })) : []
  sim.wind = wind
  sim.sun = isDay && ['clear', 'partly'].includes(scene)
  sim.moon = !isDay && ['clear', 'partly'].includes(scene)
  sim.storm = scene === 'storm'
  sim.shoot = null
  return sim
}

export function step(sim, dt) {
  const { w, h } = sim
  sim.t += dt
  for (const c of sim.clouds) { c.x += c.v * dt; if (c.x - c.s * 1.8 > w) c.x = -c.s * 1.8 }
  for (const d of sim.drops) { d.y += d.v * dt; d.x += d.v * dt * (0.18 + sim.wind * 0.35); if (d.y > h + 20) { d.y = -20; d.x = rand(-0.1, 1.1) * w } }
  for (const f of sim.flakes) { f.y += f.v * dt; f.ph += dt * 1.4; if (f.y > h + 8) { f.y = -8; f.x = rand(0, w) } }
  for (const f of sim.fog) { f.x += f.v * dt; if (f.x > w + 200) f.x = -200; if (f.x < -200) f.x = w + 200 }
  if (sim.flash > 0) sim.flash = Math.max(0, sim.flash - dt * 2.6)
  if (sim.storm) {
    sim.nextBolt -= dt
    if (sim.nextBolt <= 0) {
      sim.nextBolt = rand(4, 9); sim.flash = 1
      const pts = []; let x = rand(0.25, 0.75) * w; let y = 0
      while (y < h * 0.75) { pts.push([x, y]); x += rand(-26, 26); y += rand(16, 34) }
      sim.bolt = pts
    }
  }
  if (sim.moon) {
    if (!sim.shoot && Math.random() < dt * 0.05) sim.shoot = { x: rand(0.3, 0.9) * w, y: rand(0, 0.3) * h, life: 0 }
    if (sim.shoot) { sim.shoot.life += dt; sim.shoot.x -= 260 * dt; sim.shoot.y += 120 * dt; if (sim.shoot.life > 0.7) sim.shoot = null }
  }
}

export function draw(ctx, sim) {
  const { w, h, t } = sim
  ctx.clearRect(0, 0, w, h)
  for (const s of sim.stars) { ctx.fillStyle = `rgba(255,255,255,${0.35 + 0.65 * Math.abs(Math.sin(t * s.sp + s.ph))})`; ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, 6.283); ctx.fill() }
  if (sim.shoot) { const s = sim.shoot; const g = ctx.createLinearGradient(s.x, s.y, s.x + 60, s.y - 28); g.addColorStop(0, 'rgba(255,255,255,0.9)'); g.addColorStop(1, 'rgba(255,255,255,0)'); ctx.strokeStyle = g; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(s.x + 60, s.y - 28); ctx.stroke() }
  if (sim.sun) {
    const x = w * 0.8; const y = h * 0.26
    glow(ctx, x, y, h * 0.85, 'rgba(255,236,170,0.55)'); glow(ctx, x, y, h * 0.32, 'rgba(255,248,214,0.95)', 'rgba(255,225,140,0)')
    ctx.save(); ctx.translate(x, y); ctx.rotate(t * 0.05)
    for (let i = 0; i < 14; i++) { ctx.rotate((Math.PI * 2) / 14); const g = ctx.createLinearGradient(0, 0, h * 0.9, 0); g.addColorStop(0, 'rgba(255,240,190,0.22)'); g.addColorStop(1, 'rgba(255,240,190,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(h * 0.1, -5); ctx.lineTo(h * 0.9, -22); ctx.lineTo(h * 0.9, 22); ctx.lineTo(h * 0.1, 5); ctx.closePath(); ctx.fill() }
    ctx.restore(); ctx.fillStyle = 'rgba(255,252,235,0.95)'; ctx.beginPath(); ctx.arc(x, y, h * 0.1, 0, 6.283); ctx.fill()
  }
  if (sim.moon) {
    const x = w * 0.8; const y = h * 0.25; const r = h * 0.1
    glow(ctx, x, y, h * 0.6, 'rgba(190,208,255,0.35)'); ctx.fillStyle = '#eef2ff'; ctx.beginPath(); ctx.arc(x, y, r, 0, 6.283); ctx.fill()
    ctx.fillStyle = 'rgba(150,165,205,0.35)'; for (const [dx, dy, rr] of [[-0.3, -0.2, 0.22], [0.25, 0.1, 0.3], [-0.1, 0.45, 0.16]]) { ctx.beginPath(); ctx.arc(x + dx * r, y + dy * r, rr * r, 0, 6.283); ctx.fill() }
  }
  for (const c of sim.clouds) drawCloud(ctx, c.x, c.y, c.s, sim.cloudTint, c.a)
  for (const f of sim.fog) { const g = ctx.createLinearGradient(f.x - 200, 0, f.x + 200, 0); g.addColorStop(0, 'rgba(235,240,246,0)'); g.addColorStop(0.5, `rgba(235,240,246,${f.a})`); g.addColorStop(1, 'rgba(235,240,246,0)'); ctx.fillStyle = g; ctx.fillRect(f.x - 200, f.y - 18, 400, 36) }
  if (sim.drops.length) { ctx.lineWidth = 1.3; ctx.lineCap = 'round'; const k = 0.18 + sim.wind * 0.35; for (const d of sim.drops) { ctx.strokeStyle = `rgba(190,220,255,${d.a})`; ctx.beginPath(); ctx.moveTo(d.x, d.y); ctx.lineTo(d.x - d.l * k, d.y - d.l); ctx.stroke() } }
  for (const f of sim.flakes) { ctx.fillStyle = 'rgba(255,255,255,0.88)'; ctx.beginPath(); ctx.arc(f.x + Math.sin(f.ph) * f.sway, f.y, f.r, 0, 6.283); ctx.fill() }
  if (sim.flash > 0) {
    ctx.fillStyle = `rgba(210,220,255,${sim.flash * 0.35})`; ctx.fillRect(0, 0, w, h)
    if (sim.bolt) { ctx.strokeStyle = `rgba(255,255,255,${Math.min(1, sim.flash * 1.4)})`; ctx.shadowColor = 'rgba(180,200,255,0.9)'; ctx.shadowBlur = 14; ctx.lineWidth = 2.2; ctx.beginPath(); sim.bolt.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke(); ctx.shadowBlur = 0 }
  }
}

export default function WeatherScene({ scene = 'clear', isDay = true, windKmh = 0 }) {
  const ref = useRef(null)
  useEffect(() => {
    const canvas = ref.current
    const ctx = canvas && canvas.getContext ? canvas.getContext('2d') : null
    if (!ctx) return undefined
    const reduced = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const dpr = Math.min(2, (typeof window !== 'undefined' && window.devicePixelRatio) || 1)
    let sim = null; let raf = 0; let last = 0; let visible = true
    const size = () => {
      const r = canvas.getBoundingClientRect()
      const w = Math.max(1, Math.round(r.width)); const h = Math.max(1, Math.round(r.height))
      canvas.width = w * dpr; canvas.height = h * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      sim = makeSim(scene, isDay, windKmh, w, h)
      if (reduced) { for (let i = 0; i < 40; i++) step(sim, 0.05); draw(ctx, sim) }
    }
    size()
    const frame = (ts) => {
      raf = requestAnimationFrame(frame)
      if (!visible || document.hidden || !sim) { last = ts; return }
      const dt = Math.min(0.05, (ts - (last || ts)) / 1000); last = ts
      step(sim, dt); draw(ctx, sim)
    }
    if (!reduced) raf = requestAnimationFrame(frame)
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(size) : null
    if (ro) ro.observe(canvas)
    const io = typeof IntersectionObserver !== 'undefined' ? new IntersectionObserver(([e]) => { visible = !!(e && e.isIntersecting) }) : null
    if (io) io.observe(canvas)
    return () => { cancelAnimationFrame(raf); if (ro) ro.disconnect(); if (io) io.disconnect() }
  }, [scene, isDay, windKmh])
  return <canvas ref={ref} className="wx-scene" aria-hidden="true" />
}
