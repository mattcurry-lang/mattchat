import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import WeatherIcon from './WeatherIcons'
import WeatherScene from './WeatherScene'
import { useWeather } from './useWeather'
import { describeCode, skyFor } from './weatherCodes'
import {
  temp, tempN, speed, distance, rainAmount, pressure, compass, uvInfo, aqiInfo, feelsNote, tempColor, clockLabel, dayLabel,
  METRICS, metricSeries, dailyBars, sunProgress, buildTips, summarize, minutesSinceUpdate, defaultUnit, sparkPath, distanceKmBetween, visibilityNote, humidityNote,
} from './weatherLogic'
import { loadStore, saveStore, addPlace, removePlace, placeKey, getGeoPermission, getPosition } from './weatherStore'
import { searchPlaces, reverseGeocode, cachedWeather, fetchWeather, flag } from './weatherService'
import './weather.css'

const hour12Pref = () => { try { return new Intl.DateTimeFormat(undefined, { hour: 'numeric' }).resolvedOptions().hour12 !== false } catch { return true } }
const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches

function useCountUp(target, ms = 800) {
  const [v, setV] = useState(target == null ? 0 : reducedMotion() ? target : 0)
  const from = useRef(reducedMotion() ? target : 0)
  useEffect(() => {
    if (target == null) return undefined
    if (reducedMotion()) { setV(target); return undefined }
    const start = performance.now(); const a = from.current; let raf
    const tick = (t) => {
      const p = Math.min(1, (t - start) / ms); const e = 1 - (1 - p) ** 3
      setV(Math.round(a + (target - a) * e))
      if (p < 1) raf = requestAnimationFrame(tick); else from.current = target
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, ms])
  return v
}

const Pin = ({ size = 14 }) => (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z" /><circle cx="12" cy="9.5" r="2.4" /></svg>)
const Icon = ({ d, size = 16 }) => (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>)
const I = { refresh: 'M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7', close: 'M6 6l12 12M18 6L6 18', plus: 'M12 5v14M5 12h14', search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zm9 16-4-4' }

// ── place search (also the fallback when location is off) ──
function PlaceSearch({ onPick, onClose, autoFocus = true, placeholder = 'Search a city…' }) {
  const [q, setQ] = useState('')
  const [res, setRes] = useState([])
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  useEffect(() => {
    const t = q.trim()
    if (t.length < 2) { setRes([]); setErr(''); return undefined }
    let live = true
    const id = setTimeout(async () => {
      setBusy(true); setErr('')
      try { const r = await searchPlaces(t); if (live) { setRes(r); if (!r.length) setErr(`No places found for “${t}”.`) } } catch { if (live) setErr('Couldn’t search right now.') }
      if (live) setBusy(false)
    }, 260)
    return () => { live = false; clearTimeout(id) }
  }, [q])
  return (
    <div className="wx-search">
      <div className="wx-search-in">
        <Icon d={I.search} size={15} />
        <input autoFocus={autoFocus} value={q} placeholder={placeholder} aria-label="Search for a city" autoComplete="off" spellCheck={false}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && res[0]) onPick(res[0]); if (e.key === 'Escape') onClose && onClose() }} />
        {busy && <span className="wx-spinner" aria-label="Searching" />}
        {onClose && <button className="wx-x" onClick={onClose} aria-label="Close search"><Icon d={I.close} size={13} /></button>}
      </div>
      {(res.length > 0 || err) && (
        <ul className="wx-results">
          {res.map((r, i) => (
            <li key={`${r.lat},${r.lon},${i}`}>
              <button onClick={() => onPick(r)}>
                <span className="wx-flag">{flag(r.countryCode) || '🌍'}</span>
                <span className="wx-res-name"><b>{r.name}</b><small>{[r.region, r.country].filter(Boolean).join(', ')}</small></span>
              </button>
            </li>
          ))}
          {err && !res.length && <li className="wx-res-empty">{err}</li>}
        </ul>
      )}
    </div>
  )
}

// ── the "where should I check?" screen, shown ONLY if you've never shared a location ──
function Consent({ busy, onShare, onSearch }) {
  return (
    <div className="wx-state">
      <div className="wx-pin-orb" aria-hidden="true"><i /><i /><i /><span><Pin size={26} /></span></div>
      <h3>Where should I check the weather?</h3>
      <p>Share your location once and I’ll show your local forecast instantly, every time. It stays on this device — I only use it for weather.</p>
      <div className="wx-state-actions">
        <button className="wx-btn wx-btn-primary" onClick={onShare} disabled={busy}>{busy ? 'Finding you…' : <><Pin size={15} /> Use my location</>}</button>
        <button className="wx-btn" onClick={onSearch}>Search a city</button>
      </div>
      <small className="wx-fine">You can change this any time.</small>
    </div>
  )
}
function Denied({ onSearch, onRetry }) {
  return (
    <div className="wx-state">
      <div className="wx-pin-orb wx-pin-off" aria-hidden="true"><span><Pin size={26} /></span></div>
      <h3>Location is turned off</h3>
      <p>Your browser is blocking location for Mattchat. To use local weather, tap the lock icon next to the address, open <b>Site settings</b>, set <b>Location</b> to <b>Allow</b>, then try again. Or just search a city.</p>
      <div className="wx-state-actions">
        <button className="wx-btn wx-btn-primary" onClick={onSearch}>Search a city</button>
        <button className="wx-btn" onClick={onRetry}>Try again</button>
      </div>
    </div>
  )
}

function Skeleton() {
  return (
    <div className="wx-skel" aria-busy="true" aria-label="Loading weather">
      <div className="wx-skel-hero"><i style={{ width: '38%' }} /><i style={{ width: '58%', height: 64 }} /><i style={{ width: '44%' }} /></div>
      <div className="wx-skel-row"><i /><i /><i /><i /><i /></div>
      <div className="wx-skel-block" /><div className="wx-skel-block" />
    </div>
  )
}

function Hourly({ w, unit, hour12 }) {
  const [metric, setMetric] = useState('temp')
  const series = useMemo(() => metricSeries(w.hourly, metric, unit, 24, hour12), [w, metric, unit, hour12])
  const colW = 62; const width = series.points.length * colW; const height = 54
  const spark = useMemo(() => sparkPath(series.points.map((p) => p.value), width, height, 8), [series, width])
  const rain = metric === 'rain'
  return (
    <section className="wx-panel wx-hourly" style={{ '--i': 3 }}>
      <header className="wx-panel-h">
        <span>Next 24 hours</span>
        <div className="wx-seg" role="tablist" aria-label="Hourly metric">
          {METRICS.map((m) => (<button key={m.id} role="tab" aria-selected={metric === m.id} className={metric === m.id ? 'on' : ''} onClick={() => setMetric(m.id)}>{m.label}</button>))}
        </div>
      </header>
      <div className="wx-strip" tabIndex={0} aria-label="Hourly forecast, scroll sideways">
        <div className="wx-strip-in" style={{ width }}>
          <svg className="wx-spark" width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
            <defs><linearGradient id="wx-sg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#fff" stopOpacity=".32" /><stop offset="1" stopColor="#fff" stopOpacity="0" /></linearGradient></defs>
            {!rain && spark.area && <path d={spark.area} fill="url(#wx-sg)" />}
            {!rain && spark.line && <path className="wx-spark-line" d={spark.line} fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" pathLength="1" />}
            {rain && series.points.map((p, i) => (<rect key={i} className="wx-bar-grow" x={i * colW + colW / 2 - 7} width="14" rx="5" y={height - Math.max(3, (p.value / 100) * (height - 6))} height={Math.max(3, (p.value / 100) * (height - 6))} fill="#8fd0ff" fillOpacity={0.35 + p.value / 160} />))}
            {!rain && spark.pts.map((p, i) => (<circle key={i} cx={p.x} cy={p.y} r={i === 0 ? 4 : 2.4} fill="#fff" fillOpacity={i === 0 ? 1 : 0.8} />))}
          </svg>
          {series.points.map((p, i) => (
            <div key={p.time} className={`wx-hr${i === 0 ? ' now' : ''}`} style={{ left: i * colW, width: colW }}>
              <span className="wx-hr-t">{p.label}</span>
              <span className="wx-hr-ic"><WeatherIcon name={describeCode(p.code, p.isDay).icon} isDay={p.isDay} size={28} /></span>
              <span className="wx-hr-gap" style={{ height }} />
              <b className="wx-hr-v">{p.display}</b>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function Daily({ w, unit }) {
  const today = w.daily[0] && w.daily[0].date
  const bars = useMemo(() => dailyBars(w.daily, w.current.tempC), [w])
  return (
    <section className="wx-panel wx-daily" style={{ '--i': 4 }}>
      <header className="wx-panel-h"><span>{bars.length}-day forecast</span></header>
      {bars.map((d, i) => (
        <div key={d.date} className="wx-day" style={{ '--d': i }}>
          <span className="wx-day-n">{dayLabel(d.date, today)}</span>
          <WeatherIcon name={describeCode(d.code, true).icon} size={26} title={describeCode(d.code, true).label} />
          <span className="wx-day-rain">{d.precipProbMax >= 20 ? `${Math.round(d.precipProbMax)}%` : ''}</span>
          <span className="wx-day-lo">{temp(d.minC, unit)}</span>
          <div className="wx-range" aria-hidden="true">
            <i style={{ left: `${d.left}%`, width: `${d.width}%`, background: `linear-gradient(90deg, ${tempColor(d.minC)}, ${tempColor(d.maxC)})` }} />
            {d.dot != null && <b style={{ left: `${d.dot}%` }} />}
          </div>
          <span className="wx-day-hi">{temp(d.maxC, unit)}</span>
        </div>
      ))}
    </section>
  )
}

function Tile({ title, icon, children, wide, i }) {
  return (<div className={`wx-tile${wide ? ' wide' : ''}`} style={{ '--i': i }}><div className="wx-tile-h">{icon}<span>{title}</span></div>{children}</div>)
}

function Tiles({ w, unit, hour12 }) {
  const c = w.current; const today = w.daily[0] || {}
  const uv = uvInfo(c.uv); const aq = w.aq ? aqiInfo(w.aq.usAqi) : null
  const wind = speed(c.windKmh, unit); const gust = speed(c.gustKmh, unit)
  const vis = distance(c.visibilityM != null ? c.visibilityM / 1000 : null, unit)
  const pr = pressure(c.pressure, unit); const rain = rainAmount(today.precipSumMm, unit)
  const sun = sunProgress(w)
  const arc = (p) => { const a = Math.PI * (1 - p); return [60 + 46 * Math.cos(a), 62 - 46 * Math.sin(a)] }
  const [sx, sy] = sun ? arc(sun.progress) : [60, 62]
  return (
    <div className="wx-tiles">
      <Tile i={5} title="Feels like" icon="🌡️"><b className="wx-big">{temp(c.feelsC, unit)}</b><p>{feelsNote(c.tempC, c.feelsC)}</p></Tile>
      <Tile i={6} title="Humidity" icon="💧"><b className="wx-big">{c.humidity != null ? `${Math.round(c.humidity)}%` : '–'}</b><p>{humidityNote(c.humidity)}{c.dewC != null ? ` · dew point ${temp(c.dewC, unit)}` : ''}</p></Tile>
      <Tile i={7} title="Wind" icon="🌬️">
        <div className="wx-wind">
          <svg viewBox="0 0 80 80" width="74" height="74" aria-hidden="true">
            <circle cx="40" cy="40" r="35" fill="none" stroke="rgba(255,255,255,.22)" strokeWidth="1.5" />
            {['N', 'E', 'S', 'W'].map((l, k) => (<text key={l} x={40 + Math.sin((k * Math.PI) / 2) * 28} y={43 + -Math.cos((k * Math.PI) / 2) * 28} fontSize="8" fill="rgba(255,255,255,.7)" textAnchor="middle" fontWeight="700">{l}</text>))}
            <g className="wx-needle" style={{ transform: `rotate(${(c.windDeg || 0) + 180}deg)`, transformOrigin: '40px 40px' }}><path d="M40 16l5 14h-10z" fill="#fff" /><line x1="40" y1="30" x2="40" y2="54" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" /></g>
          </svg>
          <div><b className="wx-big">{wind.v}<small> {wind.u}</small></b><p>From {compass(c.windDeg)}{c.gustKmh != null ? ` · gusts ${gust.v}` : ''}</p></div>
        </div>
      </Tile>
      <Tile i={8} title="UV index" icon="☀️"><b className="wx-big">{c.uv != null ? Math.round(c.uv) : '–'}<small> {uv.label}</small></b>
        <div className="wx-scale uv"><span style={{ left: `${Math.min(100, ((c.uv || 0) / 11) * 100)}%` }} /></div><p>{uv.advice}</p></Tile>
      <Tile i={9} title="Sunrise & sunset" icon="🌅" wide>
        {sun ? (<div className="wx-sun">
          <svg viewBox="0 0 120 74" width="150" height="92" aria-hidden="true">
            <path d="M14 62A46 46 0 0 1 106 62" fill="none" stroke="rgba(255,255,255,.25)" strokeWidth="2" strokeDasharray="3 4" />
            <path d="M14 62A46 46 0 0 1 106 62" fill="none" stroke="#ffd166" strokeWidth="2.6" strokeLinecap="round" pathLength="1" strokeDasharray={`${sun.progress} 1`} />
            <line x1="8" y1="62" x2="112" y2="62" stroke="rgba(255,255,255,.3)" strokeWidth="1.4" />
            {sun.isDay ? (<><circle cx={sx} cy={sy} r="9" fill="#ffd166" opacity=".3" /><circle cx={sx} cy={sy} r="5" fill="#fff3b0" /></>) : <text x="60" y="44" textAnchor="middle" fontSize="16">🌙</text>}
          </svg>
          <div className="wx-sun-t"><div><small>Sunrise</small><b>{clockLabel(sun.sunrise, hour12)}</b></div><div><small>Sunset</small><b>{clockLabel(sun.sunset, hour12)}</b></div><p>{Math.floor(sun.daylightMin / 60)}h {sun.daylightMin % 60}m of daylight</p></div>
        </div>) : <p>–</p>}
      </Tile>
      <Tile i={10} title="Air quality" icon="🍃">
        {aq ? (<><b className="wx-big">{Math.round(w.aq.usAqi)}<small> {aq.label}</small></b><div className="wx-scale aqi"><span style={{ left: `${Math.min(100, (w.aq.usAqi / 300) * 100)}%` }} /></div><p>{aq.advice}{w.aq.pm25 != null ? ` PM2.5 ${Math.round(w.aq.pm25)} µg/m³.` : ''}</p></>) : <p>Not available for this place right now.</p>}
      </Tile>
      <Tile i={11} title="Visibility" icon="👁️"><b className="wx-big">{vis.v}<small> {vis.u}</small></b><p>{visibilityNote(c.visibilityM)}</p></Tile>
      <Tile i={12} title="Pressure" icon="🧭"><b className="wx-big">{pr.v}<small> {pr.u}</small></b><p>{c.cloud != null ? `${Math.round(c.cloud)}% cloud cover` : ''}</p></Tile>
      <Tile i={13} title="Rain today" icon="🌧️"><b className="wx-big">{rain.v}<small> {rain.u}</small></b><p>{today.precipProbMax != null ? `${Math.round(today.precipProbMax)}% chance at most` : ''}</p></Tile>
    </div>
  )
}

/**
 * The weather card. `placeQuery` is a place name someone asked for ("Paris"); without one it shows your own
 * location — asking for permission only if you've never shared it.
 */
export default function WeatherCard({ placeQuery = null, nonce = 0, onClose }) {
  const [store, setStore] = useState(loadStore)
  const [unit, setUnit] = useState(() => loadStore().unit || defaultUnit())
  const [mode, setMode] = useState('checking') // checking | consent | denied | locating | ready | notfound | geoerror
  const [sel, setSel] = useState(null)
  const [busy, setBusy] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [msg, setMsg] = useState('')
  const [temps, setTemps] = useState({})
  const hour12 = useMemo(hour12Pref, [])
  const { data, status, error, refresh } = useWeather(sel)

  const choose = useCallback((p) => { setSel(p); setMode('ready'); setSearchOpen(false); setMsg('') }, [])

  const locate = useCallback(async () => {
    setBusy(true); setMode('locating'); saveStore({ asked: true })
    try {
      const pos = await getPosition()
      const info = await reverseGeocode(pos.lat, pos.lon)
      const home = { ...info, lat: pos.lat, lon: pos.lon }
      setStore(saveStore({ home, asked: true }))
      choose({ ...home, isHome: true })
    } catch (e) {
      if (e && e.code === 'denied') setMode('denied')
      else { setMsg((e && e.message) || 'Couldn’t find your location.'); setMode('geoerror') }
    }
    setBusy(false)
  }, [choose])

  useEffect(() => {
    let live = true
    ;(async () => {
      const st = loadStore(); setStore(st)
      if (placeQuery) {
        setMode('locating')
        try {
          const r = await searchPlaces(placeQuery, 1)
          if (!live) return
          if (r.length) choose(r[0]); else { setMsg(placeQuery); setMode('notfound') }
        } catch { if (live) { setMsg('Couldn’t look that place up right now.'); setMode('geoerror') } }
        return
      }
      const perm = await getGeoPermission()
      if (!live) return
      if (st.home) {
        choose({ ...st.home, isHome: true })
        if (perm === 'granted') { // quietly notice if you've moved
          try { const pos = await getPosition(); if (live && distanceKmBetween(st.home, pos) > 3) { const info = await reverseGeocode(pos.lat, pos.lon); const home = { ...info, lat: pos.lat, lon: pos.lon }; setStore(saveStore({ home })); choose({ ...home, isHome: true }) } } catch { /* keep the saved home */ }
        }
        return
      }
      if (perm === 'granted') locate()
      else if (perm === 'denied') setMode('denied')
      else setMode('consent')
    })()
    return () => { live = false }
  }, [placeQuery, nonce, locate, choose])

  // live temperatures on the place chips (served from cache when fresh)
  const chips = useMemo(() => [...(store.home ? [{ ...store.home, isHome: true }] : []), ...store.places], [store])
  useEffect(() => {
    let live = true
    chips.slice(0, 9).forEach(async (p) => {
      const k = placeKey(p); const hit = cachedWeather(p)
      if (hit) { setTemps((t) => ({ ...t, [k]: hit.current })); return }
      try { const d = await fetchWeather(p); if (live) setTemps((t) => ({ ...t, [k]: d.current })) } catch { /* chip just shows no temp */ }
    })
    return () => { live = false }
  }, [chips])

  const toggleUnit = () => { const next = unit === 'c' ? 'f' : 'c'; setUnit(next); saveStore({ unit: next }) }
  const savePlace = (p) => { setStore((s) => ({ ...s, places: addPlace(p) })) }
  const isSaved = sel && (sel.isHome || store.places.some((x) => placeKey(x) === placeKey(sel)))
  const pick = (r) => { choose({ name: r.name, region: r.region, country: r.country, countryCode: r.countryCode, lat: r.lat, lon: r.lon }) }

  const w = data
  const c = w && w.current
  const desc = c ? describeCode(c.code, c.isDay) : null
  const sky = desc ? skyFor(desc.scene, c.isDay) : skyFor('cloudy', true)
  const hi = w && w.daily[0] ? w.daily[0].maxC : null; const lo = w && w.daily[0] ? w.daily[0].minC : null
  const tempShown = useCountUp(c ? tempN(c.tempC, unit) : null)
  const mins = w ? minutesSinceUpdate(w) : null
  const tips = useMemo(() => (w ? buildTips(w, unit, hour12) : []), [w, unit, hour12])
  const summary = useMemo(() => (w ? summarize(w, unit, hour12) : ''), [w, unit, hour12])
  const showSearchOnly = ['consent', 'denied', 'notfound', 'geoerror'].includes(mode)

  return (
    <article className="wx-card" style={{ background: `linear-gradient(180deg, ${sky[0]} 0%, ${sky[1]} 100%)` }} aria-label="Weather">
      {/* places bar */}
      <div className="wx-places">
        <div className="wx-chips">
          {chips.map((p) => {
            const k = placeKey(p); const t = temps[k]
            return (
              <span key={k} className={`wx-chip${sel && placeKey(sel) === k ? ' on' : ''}`}>
                <button onClick={() => choose({ ...p })} title={p.name}>{p.isHome && <Pin size={11} />}<span>{p.isHome ? 'My location' : p.name}</span>{t && <em>{temp(t.tempC, unit)}</em>}</button>
                {!p.isHome && <button className="wx-chip-x" onClick={() => setStore((s) => ({ ...s, places: removePlace(k) }))} aria-label={`Remove ${p.name}`}><Icon d={I.close} size={10} /></button>}
              </span>
            )
          })}
          <button className="wx-chip wx-chip-add" onClick={() => setSearchOpen((v) => !v)} aria-label="Add or search a place" aria-expanded={searchOpen}><Icon d={I.plus} size={13} /><span>Places</span></button>
        </div>
        {onClose && <button className="wx-x wx-close" onClick={onClose} aria-label="Close weather"><Icon d={I.close} size={14} /></button>}
      </div>
      {(searchOpen || (showSearchOnly && mode !== 'consent' && mode !== 'denied')) && <PlaceSearch onPick={pick} onClose={searchOpen ? () => setSearchOpen(false) : undefined} />}

      {mode === 'checking' && <Skeleton />}
      {mode === 'locating' && !w && <Skeleton />}
      {mode === 'consent' && <Consent busy={busy} onShare={locate} onSearch={() => setSearchOpen(true)} />}
      {mode === 'denied' && <Denied onSearch={() => setSearchOpen(true)} onRetry={locate} />}
      {mode === 'notfound' && (<div className="wx-state"><h3>I couldn’t find “{msg}”</h3><p>Check the spelling, or try adding the country — like “Paris, France”.</p></div>)}
      {mode === 'geoerror' && (<div className="wx-state"><h3>{msg || 'Something went wrong'}</h3><div className="wx-state-actions"><button className="wx-btn wx-btn-primary" onClick={locate}>Try again</button><button className="wx-btn" onClick={() => setSearchOpen(true)}>Search a city</button></div></div>)}

      {mode === 'ready' && !w && status === 'loading' && <Skeleton />}
      {mode === 'ready' && !w && status === 'error' && (
        <div className="wx-state"><h3>Couldn’t load the weather</h3><p>{error}</p><div className="wx-state-actions"><button className="wx-btn wx-btn-primary" onClick={refresh}>Try again</button></div></div>
      )}

      {mode === 'ready' && w && c && (
        <>
          <section className="wx-hero" style={{ '--i': 0 }}>
            <WeatherScene scene={desc.scene} isDay={c.isDay} windKmh={c.windKmh} />
            <div className="wx-hero-top">
              <div className="wx-place">
                <b>{sel.isHome && <Pin size={13} />} {sel.name}</b>
                <span>{[sel.region, sel.country].filter(Boolean).join(', ')} {flag(sel.countryCode)}</span>
              </div>
              <div className="wx-actions">
                <button className="wx-pill" onClick={toggleUnit} aria-label={`Switch to ${unit === 'c' ? 'Fahrenheit' : 'Celsius'}`}>°{unit.toUpperCase()}</button>
                <button className={`wx-x${status === 'refreshing' ? ' spin' : ''}`} onClick={refresh} aria-label="Refresh"><Icon d={I.refresh} size={15} /></button>
                {!isSaved && <button className="wx-pill" onClick={() => savePlace(sel)}>＋ Save</button>}
              </div>
            </div>
            <div className="wx-hero-main">
              <div className="wx-temp" aria-label={`${temp(c.tempC, unit)} ${desc.label}`}>{tempShown}<sup>°</sup></div>
              <div className="wx-cond"><WeatherIcon name={desc.icon} isDay={c.isDay} size={46} animated /><span>{desc.label}</span></div>
              <div className="wx-hilo">H {temp(hi, unit)} · L {temp(lo, unit)} · Feels like {temp(c.feelsC, unit)}</div>
            </div>
            <div className="wx-updated" aria-live="polite">{mins == null ? '' : mins < 2 ? 'Updated just now' : `Updated ${mins} min ago`}</div>
          </section>

          <section className="wx-panel wx-curry" style={{ '--i': 1 }}>
            <div className="wx-curry-h"><span className="wx-spark-ic">✦</span> Curry says</div>
            <p>{summary}</p>
            {tips.length > 0 && (<ul className="wx-tips">{tips.map((t) => (<li key={t.id}><span>{t.emoji}</span>{t.text}</li>))}</ul>)}
          </section>

          <Hourly w={w} unit={unit} hour12={hour12} />
          <Daily w={w} unit={unit} />
          <Tiles w={w} unit={unit} hour12={hour12} />
        </>
      )}

      <footer className="wx-foot">
        <a href="https://open-meteo.com/" target="_blank" rel="noopener noreferrer">Weather data by Open-Meteo.com</a>
      </footer>
    </article>
  )
}
