// src/beyond/environments/WorldEnv.jsx
//
// WORLD: full-screen map of where the person you are talking to is, if (and only
// if) they are sharing with you right now. Lazy-loaded; MapLibre is not part of
// the chat bundle.
//
// All "may I show this?" decisions come from classifyLocation via
// useContactLocation. This file only draws what it is told it may draw.

import React, { useCallback, useEffect, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl/dist/maplibre-gl-csp'
import 'maplibre-gl/dist/maplibre-gl.css'
import Avatar from '../../components/Avatar'
import { useContactLocation } from '../useContactLocation'
import { useContactBattery } from '../useContactBattery'
import BatteryCard from '../BatteryCard'
import { LocationState } from '../services/locationFreshness'
import { problemText } from '../services/dbProblem'
import { prefersReducedMotion } from '../motion'
import { STYLE_URL, darkenStyle, circlePolygon, EMPTY_FC } from './mapStyle'

// The CSP build runs its worker from a plain file we copy into /public
// (scripts/copy-maplibre-worker.js). This avoids Create React App mangling the worker.
maplibregl.setWorkerUrl(`${process.env.PUBLIC_URL || ''}/maplibre-gl-csp-worker.js`)

const DURATIONS = [
  { minutes: 15, label: '15 minutes' },
  { minutes: 60, label: '1 hour' },
  { minutes: 480, label: '8 hours' },
]

const SHARE_ERRORS = {
  denied: 'Location access is blocked. Allow it for Mattchat in your browser settings, then try again.',
  unsupported: 'This browser cannot share a live location.',
  failed: 'Something went wrong. Try again.',
}

const CSS = `
.bdw{position:absolute;inset:0;background:#07050d}
.bdw-map{position:absolute;inset:0}
.bdw-vignette{position:absolute;inset:0;pointer-events:none;
  background:radial-gradient(120% 90% at 50% 45%,transparent 55%,rgba(7,5,13,.72) 100%)}

.bdw-ctrls{position:absolute;top:10px;right:12px;display:flex;flex-direction:column;gap:8px;z-index:3}
.bdw-btn{width:44px;height:44px;display:flex;align-items:center;justify-content:center;border-radius:50%;
  border:1px solid rgba(167,139,250,.28);background:rgba(12,7,24,.82);color:#f1eefc;cursor:pointer;transition:background .18s,border-color .18s}
.bdw-btn:hover:not(:disabled){background:rgba(108,99,255,.3);border-color:rgba(167,139,250,.55)}
.bdw-btn:disabled{opacity:.4;cursor:default}
.bdw-btn:focus-visible,.bdw-chip:focus-visible,.bdw-link:focus-visible,.bdw-sum:focus-visible{outline:2px solid #a78bfa;outline-offset:2px}

.bdw-panel{position:absolute;left:12px;right:12px;bottom:calc(env(safe-area-inset-bottom,0px) + 90px);z-index:3;
  max-width:440px;margin:0 auto;padding:16px 16px 14px;border-radius:26px 26px 26px 10px;
  background:rgba(12,7,24,.88);border:1px solid rgba(167,139,250,.22);box-shadow:0 18px 50px rgba(0,0,0,.55);color:#f1eefc}
.bdw-row{display:flex;align-items:center;gap:12px}
.bdw-who{min-width:0;flex:1}
.bdw-name{font-size:15.5px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.bdw-status{display:flex;align-items:center;gap:8px;margin-top:2px;font-size:13px;color:#d9d2f3}
.bdw-dot{width:8px;height:8px;border-radius:50%;flex:none;background:#7d7595}
.bdw-dot[data-s="live"]{background:#7be0a4;box-shadow:0 0 0 4px rgba(123,224,164,.18)}
.bdw-dot[data-s="recent"]{background:#a78bfa}
.bdw-dot[data-s="last_known"],.bdw-dot[data-s="offline"]{background:#e0b86b}
.bdw-meta{margin:10px 0 0;padding:0;list-style:none;display:flex;flex-wrap:wrap;gap:4px 14px;font-size:12.5px;color:#b8b0d6}
.bdw-actions{display:flex;gap:8px;margin-top:12px}
.bdw-link{display:inline-flex;align-items:center;gap:7px;min-height:40px;padding:0 16px;border-radius:999px;font:inherit;font-size:13px;font-weight:700;
  text-decoration:none;color:#fff;background:linear-gradient(135deg,#6c63ff,#5a4fe0);border:none;cursor:pointer}
.bdw-link.ghost{background:rgba(255,255,255,.06);border:1px solid rgba(167,139,250,.28);color:#f1eefc}

.bdw-share{margin-top:12px;border-top:1px solid rgba(167,139,250,.16);padding-top:10px}
.bdw-sum{cursor:pointer;font-size:13px;font-weight:700;color:#d9d2f3;list-style:none;min-height:32px;display:flex;align-items:center}
.bdw-sum::-webkit-details-marker{display:none}
.bdw-note{margin:8px 0 0;font-size:12.5px;line-height:1.5;color:#b8b0d6}
.bdw-chips{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}
.bdw-chip{min-height:40px;padding:0 14px;border-radius:999px;border:1px solid rgba(167,139,250,.35);background:rgba(108,99,255,.14);
  color:#f1eefc;font:inherit;font-size:13px;font-weight:600;cursor:pointer}
.bdw-chip:hover:not(:disabled){background:rgba(108,99,255,.32)}
.bdw-chip:disabled{opacity:.5;cursor:default}
.bdw-chip.stop{border-color:rgba(248,113,113,.5);background:rgba(248,113,113,.12);color:#fecaca}
.bdw-switch{display:flex;align-items:center;justify-content:space-between;gap:14px;margin-top:14px;padding-top:12px;border-top:1px solid rgba(167,139,250,.14);font-size:13px;font-weight:600;color:#d9d2f3;cursor:pointer}
.bdw-switch small{display:block;margin-top:2px;font-size:11.5px;font-weight:400;color:#b8b0d6;line-height:1.4}
.bdw-switch input{flex:none;width:44px;height:26px;margin:0;appearance:none;-webkit-appearance:none;border-radius:999px;position:relative;cursor:pointer;
  background:rgba(255,255,255,.16);transition:background .2s}
.bdw-switch input::after{content:"";position:absolute;top:3px;left:3px;width:20px;height:20px;border-radius:50%;background:#fff;transition:transform .2s}
.bdw-switch input:checked{background:#6c63ff}
.bdw-switch input:checked::after{transform:translateX(18px)}
.bdw-switch input:disabled{opacity:.45;cursor:default}
.bdw-switch input:focus-visible{outline:2px solid #a78bfa;outline-offset:2px}
.bdw-err{margin:8px 0 0;font-size:12.5px;color:#fbbf24}

.bdw-overlay{position:absolute;inset:0;z-index:4;display:flex;align-items:center;justify-content:center;padding:24px;text-align:center;
  background:rgba(7,5,13,.82);color:#d9d2f3;font-size:14px;line-height:1.55}

/* marker */
.bdw-marker{position:relative;width:52px;height:52px}
.bdw-face{position:absolute;inset:6px;border-radius:50%;overflow:hidden;display:flex;align-items:center;justify-content:center;
  background:#2a1f5c;color:#f1eefc;font-weight:700;font-size:18px;border:2px solid #a78bfa;box-shadow:0 6px 18px rgba(0,0,0,.55)}
.bdw-face img{width:100%;height:100%;object-fit:cover;display:block}
.bdw-ring{position:absolute;inset:0;border-radius:50%;border:2px solid rgba(167,139,250,.55)}
.bdw-marker[data-state="live"] .bdw-ring{animation:bdwPulse 2.2s ease-out infinite;border-color:rgba(123,224,164,.7)}
.bdw-marker[data-state="live"] .bdw-face{border-color:#7be0a4}
.bdw-marker[data-state="last_known"] .bdw-face,.bdw-marker[data-state="offline"] .bdw-face{filter:grayscale(.65);opacity:.82;border-color:#e0b86b}
.bdw-marker[data-state="last_known"] .bdw-ring,.bdw-marker[data-state="offline"] .bdw-ring{border-style:dashed;border-color:rgba(224,184,107,.7)}
@keyframes bdwPulse{0%{transform:scale(.8);opacity:.9}100%{transform:scale(1.7);opacity:0}}
@media (prefers-reduced-motion:reduce){.bdw-marker[data-state="live"] .bdw-ring{animation:none}.bdw-btn,.bdw-chip{transition:none}}
.maplibregl-ctrl-attrib{background:rgba(12,7,24,.7)!important;color:#b8b0d6!important}
.maplibregl-ctrl-attrib a{color:#d9d2f3!important}
`

const IconPlus = () => (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden><path d="M12 5v14M5 12h14" /></svg>)
const IconMinus = () => (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden><path d="M5 12h14" /></svg>)
const IconTarget = () => (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden><circle cx="12" cy="12" r="6.5" /><circle cx="12" cy="12" r="1.8" /><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3" /></svg>)
const IconRoute = () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M5 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM19 9a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z" /><path d="M7 17h6a3 3 0 0 0 0-6h-2a3 3 0 0 1 0-6h6" /></svg>)

function buildMarker(name, avatarUrl) {
  const initial = (name || '?').trim().charAt(0).toUpperCase() || '?'
  const el = document.createElement('div')
  el.className = 'bdw-marker'
  el.setAttribute('role', 'img')
  el.setAttribute('aria-label', `${name || 'Contact'}'s location`)
  const ring = document.createElement('span'); ring.className = 'bdw-ring'
  const face = document.createElement('span'); face.className = 'bdw-face'
  if (avatarUrl) {
    const img = document.createElement('img')
    img.alt = ''
    img.src = avatarUrl
    img.onerror = () => { img.remove(); face.textContent = initial }
    face.appendChild(img)
  } else {
    face.textContent = initial
  }
  el.append(ring, face)
  return el
}

function accuracyLine(loc) {
  if (loc.accuracyM === null) return ''
  const m = Math.round(loc.accuracyM)
  return loc.accuracyIsCoarse ? `Approximate area, about ${m} m` : `Accurate to about ${m} m`
}

const MOVEMENT_LABEL = { moving: 'Moving', still: 'Standing still' }

export default function WorldEnv({ contact, ctx, active }) {
  const { loc, problem, reload } = useContactLocation({ conversationId: ctx.conversationId, contactId: contact.id })
  const battery = useContactBattery({ conversationId: ctx.conversationId, contactId: contact.id })
  const holder = useRef(null)
  const mapRef = useRef(null)
  const markerRef = useRef(null)
  const didFly = useRef(false)
  const [mapState, setMapState] = useState('idle') // idle | loading | ready | error
  const [attempt, setAttempt] = useState(0)
  const [busy, setBusy] = useState(false)

  // ── create the map once the world is actually open ─────────────────────
  useEffect(() => {
    if (!active || !holder.current) return undefined
    let cancelled = false
    const ctrl = new AbortController()
    setMapState('loading')

    ;(async () => {
      try {
        const res = await fetch(STYLE_URL, { signal: ctrl.signal })
        if (!res.ok) throw new Error(`style ${res.status}`)
        const style = darkenStyle(await res.json())
        if (cancelled) return
        const map = new maplibregl.Map({
          container: holder.current,
          style,
          center: [20, 15],
          zoom: 1.4,
          minZoom: 1,
          maxZoom: 18,
          attributionControl: { compact: true },
          dragRotate: false,
          pitchWithRotate: false,
          touchPitch: false,
          fadeDuration: prefersReducedMotion() ? 0 : 300,
        })
        map.touchZoomRotate.disableRotation()
        mapRef.current = map
        map.on('load', () => {
          if (cancelled) return
          map.addSource('bd-acc', { type: 'geojson', data: EMPTY_FC })
          map.addLayer({ id: 'bd-acc-fill', type: 'fill', source: 'bd-acc', paint: { 'fill-color': '#6c63ff', 'fill-opacity': 0.14 } })
          map.addLayer({ id: 'bd-acc-line', type: 'line', source: 'bd-acc', paint: { 'line-color': '#a78bfa', 'line-width': 1, 'line-opacity': 0.6 } })
          setMapState('ready')
        })
      } catch (e) {
        if (!cancelled && e.name !== 'AbortError') { console.error('[beyond] map failed to load:', e); setMapState('error') }
      }
    })()

    return () => {
      cancelled = true
      ctrl.abort()
      markerRef.current?.remove()
      markerRef.current = null
      mapRef.current?.remove()
      mapRef.current = null
      didFly.current = false
    }
  }, [active, attempt])

  // keep the canvas sized while the shell animates in
  useEffect(() => {
    if (!holder.current || typeof ResizeObserver === 'undefined') return undefined
    const ro = new ResizeObserver(() => mapRef.current?.resize())
    ro.observe(holder.current)
    return () => ro.disconnect()
  }, [])

  // ── draw exactly what classifyLocation allows ──────────────────────────
  const pos = loc.canShowPosition ? loc.position : null
  useEffect(() => {
    const map = mapRef.current
    if (!map || mapState !== 'ready') return

    map.getSource('bd-acc')?.setData(pos && loc.accuracyM ? circlePolygon(pos.lng, pos.lat, Math.max(loc.accuracyM, 5)) : EMPTY_FC)

    if (!pos) {                           // stopped / expired / not sharing: nothing on the map
      markerRef.current?.remove()
      markerRef.current = null
      return
    }
    if (!markerRef.current) {
      markerRef.current = new maplibregl.Marker({ element: buildMarker(contact.name, contact.avatarUrl), anchor: 'center' })
        .setLngLat([pos.lng, pos.lat]).addTo(map)
    } else {
      markerRef.current.setLngLat([pos.lng, pos.lat])
    }
    markerRef.current.getElement().dataset.state = loc.state

    if (!didFly.current) {
      didFly.current = true
      const view = { center: [pos.lng, pos.lat], zoom: 14 }
      if (prefersReducedMotion()) map.jumpTo(view); else map.flyTo({ ...view, duration: 2200 })
    }
  }, [mapState, pos?.lat, pos?.lng, loc.state, loc.accuracyM, contact.name, contact.avatarUrl]) // eslint-disable-line react-hooks/exhaustive-deps

  const zoomBy = (d) => {
    const map = mapRef.current
    if (!map) return
    const opts = prefersReducedMotion() ? { duration: 0 } : { duration: 250 }
    d > 0 ? map.zoomIn(opts) : map.zoomOut(opts)
  }
  const recenter = () => {
    const map = mapRef.current
    if (!map || !pos) return
    const view = { center: [pos.lng, pos.lat], zoom: Math.max(map.getZoom(), 14) }
    if (prefersReducedMotion()) map.jumpTo(view); else map.flyTo({ ...view, duration: 900 })
  }

  // ── my own sharing ─────────────────────────────────────────────────────
  const live = ctx.liveShare
  const mine = live.activeFor(ctx.conversationId)
  const startShare = useCallback(async (minutes) => {
    setBusy(true)
    try { await live.start(ctx.conversationId, minutes) } catch { /* error is exposed as live.error */ }
    setBusy(false)
  }, [live, ctx.conversationId])
  const stopShare = useCallback(async () => {
    setBusy(true)
    try { await live.stop(ctx.conversationId) } catch { /* shown via live.error */ }
    setBusy(false)
  }, [live, ctx.conversationId])

  const loadError = !!problem
  const statusText = loadError && loc.state !== LocationState.LIVE ? "Couldn't check their location" : loc.label
  const dotState = loadError ? 'none' : loc.state
  const untilText = mine ? new Date(mine.expires_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : ''
  const movement = MOVEMENT_LABEL[loc.movement]
  const accuracy = accuracyLine(loc)

  return (
    <div className="bdw">
      <style>{CSS}</style>
      <div className="bdw-map" ref={holder} />
      <div className="bdw-vignette" aria-hidden />

      <div className="bdw-ctrls">
        <button className="bdw-btn" onClick={() => zoomBy(1)} aria-label="Zoom in"><IconPlus /></button>
        <button className="bdw-btn" onClick={() => zoomBy(-1)} aria-label="Zoom out"><IconMinus /></button>
        <button className="bdw-btn" onClick={recenter} disabled={!pos} aria-label={`Centre on ${contact.name}`}><IconTarget /></button>
      </div>

      {mapState === 'error' && (
        <div className="bdw-overlay" role="alert">
          <div>
            <p style={{ margin: '0 0 12px' }}>The map couldn’t load. Check your connection and try again.</p>
            <button className="bdw-link" onClick={() => setAttempt((n) => n + 1)}>Try again</button>
          </div>
        </div>
      )}

      <section className="bdw-panel" aria-live="polite" aria-label={`${contact.name}'s location`}>
        <div className="bdw-row">
          <Avatar name={contact.name} size={44} photoUrl={contact.avatarUrl} online={contact.online} />
          <div className="bdw-who">
            <div className="bdw-name">{contact.name}</div>
            <div className="bdw-status"><span className="bdw-dot" data-s={dotState} aria-hidden />{statusText}</div>
          </div>
        </div>

        {problem && <p className="bdw-err" role="alert">{problemText(problem, 'Live location')}</p>}

        {pos && (
          <ul className="bdw-meta">
            <li>{loc.updatedLabel}</li>
            {accuracy ? <li>{accuracy}</li> : null}
            {movement ? <li>{movement}</li> : null}
          </ul>
        )}

        {(pos || loadError) && (
          <div className="bdw-actions">
            {pos && (
              <a className="bdw-link" target="_blank" rel="noreferrer"
                href={`https://www.google.com/maps/dir/?api=1&destination=${pos.lat},${pos.lng}`}>
                <IconRoute /> Directions
              </a>
            )}
            {loadError && <button className="bdw-link ghost" onClick={reload}>Try again</button>}
          </div>
        )}

        <BatteryCard battery={battery} contactName={contact.name} />

        <details className="bdw-share">
          <summary className="bdw-sum">{mine ? `You’re sharing until ${untilText}` : 'Share my live location'}</summary>
          {mine ? (
            <>
              <p className="bdw-note">{contact.name} can see where you are while Mattchat is open on your phone.</p>
              <div className="bdw-chips">
                <button className="bdw-chip stop" onClick={stopShare} disabled={busy}>Stop sharing</button>
              </div>
            </>
          ) : (
            <>
              <p className="bdw-note">
                Only {contact.name} can see it. It updates while Mattchat is open, and ends by itself. You can stop any time.
              </p>
              <div className="bdw-chips" role="group" aria-label="Share for">
                {DURATIONS.map((d) => (
                  <button key={d.minutes} className="bdw-chip" onClick={() => startShare(d.minutes)} disabled={busy}>{d.label}</button>
                ))}
              </div>
            </>
          )}
          <label className="bdw-switch">
            <span>
              Share my battery with {contact.name}
              <small>{live.battery.supported ? 'Separate from location. Updates while Mattchat is open.' : 'This browser can’t report battery. Chrome on Android can.'}</small>
            </span>
            <input
              type="checkbox" role="switch"
              checked={live.battery.isOn(ctx.conversationId)}
              disabled={!live.battery.supported && !live.battery.isOn(ctx.conversationId)}
              onChange={(e) => live.battery.set(ctx.conversationId, e.target.checked)}
            />
          </label>
          {live.battery.error && <p className="bdw-err" role="alert">{live.battery.error === 'unsupported' ? 'This browser can’t report battery.' : 'Couldn’t change that. Try again.'}</p>}
          {live.error && <p className="bdw-err" role="alert">{SHARE_ERRORS[live.error] || SHARE_ERRORS.failed}</p>}
        </details>
      </section>
    </div>
  )
}
