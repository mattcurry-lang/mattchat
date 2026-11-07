// src/beyond/environments/CinemaEnv.jsx
//
// CINEMA: movie discovery from TMDB (via our edge function; no key in the browser).
//   home    featured hero, tonight's pick, rails
//   browse  search + genre + sort, with paging
//   detail  backdrop, cast, trailer, where to watch in Kenya, similar films
//
// Not here yet: the shared "Our movie" watchlist and in-chat suggestions (they need
// their own tables), and "Because you watched" (needs a watch history to read).
// Saves are personal and stay on this device, and the UI says so.

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { prefersReducedMotion } from '../motion'
import {
  LISTS, REGION, CinemaError, browse, director, genres as loadGenres, getSaved, img, loadMovie,
  mainCast, rating, runtimeLabel, toggleSaved, tonightsPick, trailerKey, year,
} from '../services/tmdb'

const CSS = `
.cn{position:absolute;inset:0;background:#050407;color:#f1eefc}
.cn-scroll{position:absolute;inset:0;overflow-y:auto;overflow-x:hidden;-webkit-overflow-scrolling:touch;
  padding-bottom:calc(env(safe-area-inset-bottom,0px) + 112px)}
.cn-serif{font-family:'Iowan Old Style','Palatino Linotype',Palatino,Georgia,serif}

.cn-bar{position:absolute;top:0;left:0;right:0;z-index:5;display:flex;align-items:center;justify-content:space-between;padding:10px 12px 0 16px;pointer-events:none}
.cn-bar > *{pointer-events:auto}
.cn-wordmark{font-size:15px;letter-spacing:.04em;color:#e6dcc8;text-shadow:0 1px 8px rgba(0,0,0,.8)}
.cn-bar-actions{display:flex;gap:8px}
.cn-icon{position:relative;width:44px;height:44px;border-radius:50%;display:flex;align-items:center;justify-content:center;
  border:1px solid rgba(255,255,255,.2);background:rgba(5,4,7,.55);color:#f1eefc;cursor:pointer}
.cn-icon:hover{background:rgba(108,99,255,.35)}
.cn-count{position:absolute;top:-2px;right:-2px;min-width:18px;height:18px;padding:0 4px;border-radius:9px;background:#6c63ff;font-size:11px;font-weight:700;display:flex;align-items:center;justify-content:center}

.cn-hero{position:relative;min-height:min(80vh,640px);display:flex;align-items:flex-end;overflow:hidden}
.cn-hero-bg{position:absolute;inset:0}
.cn-hero-bg img{width:100%;height:100%;object-fit:cover;object-position:50% 20%}
.cn-hero-shade{position:absolute;inset:0;background:
  linear-gradient(to top,#050407 3%,rgba(5,4,7,.6) 42%,rgba(5,4,7,.12) 75%),
  linear-gradient(to right,rgba(5,4,7,.72),transparent 65%)}
.cn-hero-in{position:relative;z-index:2;display:flex;gap:16px;align-items:flex-end;width:100%;max-width:1000px;margin:0 auto;padding:0 16px 22px}
.cn-poster{flex:none;width:clamp(96px,27vw,200px);aspect-ratio:2/3;border-radius:16px;object-fit:cover;background:#15101f;
  box-shadow:0 18px 50px rgba(0,0,0,.65);border:1px solid rgba(255,255,255,.1)}
.cn-hero-text{min-width:0;flex:1}
.cn-eyebrow{font-size:11.5px;letter-spacing:.16em;text-transform:uppercase;color:#a78bfa;font-weight:700;margin-bottom:6px}
.cn-title{margin:0;font-weight:500;line-height:1.05;letter-spacing:-.01em;font-size:clamp(26px,7vw,48px)}
.cn-meta{display:flex;flex-wrap:wrap;align-items:center;gap:6px 12px;margin-top:8px;font-size:13px;color:#d4cde8}
.cn-rate{display:inline-flex;align-items:center;gap:6px;padding:2px 9px;border-radius:999px;background:rgba(108,99,255,.28);border:1px solid rgba(167,139,250,.4);font-size:12.5px;font-weight:600}
.cn-rate b{font-size:10.5px;letter-spacing:.08em;color:#c9bff7}
.cn-syn{margin:10px 0 0;font-size:14px;line-height:1.55;color:#d9d2ee;max-width:56ch;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
.cn-crew{margin:8px 0 0;font-size:12.5px;color:#b8b0d6;line-height:1.5}
.cn-actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:14px}
.cn-btn{display:inline-flex;align-items:center;gap:7px;min-height:44px;padding:0 18px;border-radius:999px;border:1px solid rgba(255,255,255,.22);background:rgba(255,255,255,.08);
  color:#f1eefc;font:inherit;font-size:13.5px;font-weight:700;cursor:pointer;text-decoration:none}
.cn-btn.primary{background:linear-gradient(135deg,#6c63ff,#5a4fe0);border-color:transparent}
.cn-btn:hover{filter:brightness(1.15)}
.cn-btn[aria-pressed="true"]{background:rgba(167,139,250,.3);border-color:#a78bfa}
.cn-dots{position:absolute;z-index:3;right:16px;bottom:26px;display:flex;gap:6px;align-items:center}
.cn-dot{width:9px;height:9px;padding:0;border-radius:50%;border:none;background:rgba(255,255,255,.3);cursor:pointer}
.cn-dot[aria-current="true"]{background:#a78bfa;width:22px;border-radius:5px}
.cn-dotwrap{display:flex;align-items:center;justify-content:center;width:24px;height:44px;background:none;border:none;padding:0;cursor:pointer}

.cn-section{margin-top:26px}
.cn-h{display:flex;align-items:baseline;justify-content:space-between;padding:0 16px;margin:0 0 10px}
.cn-h h2{margin:0;font-size:18px;font-weight:500;letter-spacing:.005em}
.cn-h small{font-size:12px;color:#9d97b5}
.cn-rail{display:flex;gap:12px;overflow-x:auto;padding:4px 16px 10px;scroll-snap-type:x proximity;scrollbar-width:none}
.cn-rail::-webkit-scrollbar{display:none}
.cn-card{flex:none;width:clamp(108px,30vw,152px);scroll-snap-align:start;background:none;border:none;padding:0;text-align:left;color:inherit;font:inherit;cursor:pointer}
.cn-card .cn-poster{width:100%;box-shadow:none;border-radius:14px;transition:transform .2s}
.cn-card:hover .cn-poster,.cn-card:focus-visible .cn-poster{transform:translateY(-3px)}
.cn-card-t{margin-top:7px;font-size:12.5px;font-weight:600;line-height:1.3;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.cn-card-s{margin-top:2px;font-size:11.5px;color:#9d97b5}
.cn-sk{flex:none;width:clamp(108px,30vw,152px);aspect-ratio:2/3;border-radius:14px;background:linear-gradient(100deg,#120e1c 30%,#1d1730 50%,#120e1c 70%);background-size:200% 100%;animation:cnShimmer 1.4s linear infinite}
@keyframes cnShimmer{to{background-position:-200% 0}}

.cn-tonight{position:relative;display:block;width:calc(100% - 32px);max-width:968px;margin:0 auto;aspect-ratio:16/9;max-height:360px;border:none;padding:0;cursor:pointer;
  border-radius:24px 24px 24px 8px;overflow:hidden;background:#15101f;text-align:left;color:inherit;font:inherit}
.cn-tonight img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.cn-tonight-in{position:absolute;inset:0;display:flex;flex-direction:column;justify-content:flex-end;padding:16px 18px;background:linear-gradient(to top,rgba(5,4,7,.92),rgba(5,4,7,.1) 65%)}

.cn-note{margin:0 16px;padding:14px 16px;border-radius:16px;background:rgba(255,255,255,.04);border:1px solid rgba(167,139,250,.2);font-size:13.5px;line-height:1.55;color:#d4cde8}
.cn-retry{margin-left:10px;min-height:36px;padding:0 14px;border-radius:999px;border:1px solid rgba(167,139,250,.4);background:rgba(108,99,255,.2);color:#f1eefc;font:inherit;font-size:12.5px;font-weight:600;cursor:pointer}
.cn-foot{margin:34px 16px 0;font-size:11.5px;line-height:1.6;color:#7f789a}

.cn-detail{position:absolute;inset:0;z-index:8;background:#050407;overflow-y:auto;-webkit-overflow-scrolling:touch;padding-bottom:calc(env(safe-area-inset-bottom,0px) + 112px)}
.cn-d-hero{position:relative;height:min(46vh,380px)}
.cn-d-hero img{width:100%;height:100%;object-fit:cover}
.cn-d-hero::after{content:"";position:absolute;inset:0;background:linear-gradient(to top,#050407 2%,rgba(5,4,7,.25) 60%,rgba(5,4,7,.5))}
.cn-back{position:absolute;z-index:3;top:10px;left:12px;display:inline-flex;align-items:center;gap:6px;min-height:44px;padding:0 16px 0 10px;border-radius:999px;border:1px solid rgba(255,255,255,.22);background:rgba(5,4,7,.6);color:#f1eefc;font:inherit;font-size:13.5px;font-weight:600;cursor:pointer}
.cn-d-body{position:relative;z-index:2;max-width:980px;margin:-92px auto 0;padding:0 16px}
.cn-d-top{display:flex;gap:16px;align-items:flex-end}
.cn-chips{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px}
.cn-chip{padding:3px 11px;border-radius:999px;border:1px solid rgba(167,139,250,.35);font-size:12px;color:#d9d2ee}
.cn-tag{margin:12px 0 0;font-style:italic;color:#c9bff7;font-size:14px}
.cn-over{margin:12px 0 0;font-size:14.5px;line-height:1.65;color:#e2dcf3;max-width:62ch}
.cn-sub{margin:22px 0 8px;font-size:15px;font-weight:700;letter-spacing:.01em}
.cn-people{display:flex;flex-wrap:wrap;gap:6px 14px;font-size:13px;color:#cfc7e6}
.cn-provs{display:flex;flex-wrap:wrap;gap:10px}
.cn-prov{display:flex;align-items:center;gap:8px;padding:6px 12px 6px 6px;border-radius:999px;background:rgba(255,255,255,.05);border:1px solid rgba(167,139,250,.2);font-size:12.5px}
.cn-prov img{width:28px;height:28px;border-radius:8px}
.cn-video{position:relative;margin-top:16px;aspect-ratio:16/9;border-radius:18px;overflow:hidden;background:#000}
.cn-video iframe{position:absolute;inset:0;width:100%;height:100%;border:0}

.cn-browse{max-width:980px;margin:0 auto;padding:64px 16px 0}
.cn-filters{display:flex;flex-wrap:wrap;gap:8px}
.cn-input,.cn-select{min-height:44px;padding:0 14px;border-radius:14px;border:1px solid rgba(167,139,250,.3);background:rgba(255,255,255,.05);color:#f1eefc;font:inherit;font-size:14px}
.cn-input{flex:1 1 220px}
.cn-select option{color:#111}
.cn-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(108px,1fr));gap:14px;margin-top:16px}
.cn-grid .cn-card{width:auto}
.cn-more{display:flex;justify-content:center;margin:20px 0 0}

.cn-icon:focus-visible,.cn-btn:focus-visible,.cn-card:focus-visible,.cn-tonight:focus-visible,.cn-dotwrap:focus-visible,.cn-back:focus-visible,
.cn-input:focus-visible,.cn-select:focus-visible,.cn-retry:focus-visible{outline:2px solid #a78bfa;outline-offset:2px}
@media (prefers-reduced-motion:reduce){.cn-sk{animation:none}.cn-card .cn-poster{transition:none}}
`

/* ── icons ── */
const ico = { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true }
const IconSearch = () => (<svg width="20" height="20" {...ico}><circle cx="11" cy="11" r="6.500" /><path d="m16 16 4 4" /></svg>)
const IconBookmark = ({ filled }) => (<svg width="18" height="18" {...ico} fill={filled ? 'currentColor' : 'none'}><path d="M7 4h10v16l-5-3.500L7 20Z" /></svg>)
const IconPlay = () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M8 5.500v13l11-6.500Z" /></svg>)
const IconShare = () => (<svg width="17" height="17" {...ico}><path d="M12 15V4M8 8l4-4 4 4M5 13v6h14v-6" /></svg>)
const IconBack = () => (<svg width="16" height="16" {...ico}><path d="m14.500 6-6 6 6 6" /></svg>)
const IconClose = () => (<svg width="18" height="18" {...ico}><path d="M6 6l12 12M18 6 6 18" /></svg>)

/* ── small pieces ── */
const Rate = ({ m }) => (rating(m) ? <span className="cn-rate"><b>TMDB</b>{rating(m)}</span> : null)

function useList(name, enabled) {
  const [st, setSt] = useState({ status: 'loading', items: [], err: null })
  const load = useCallback(() => {
    setSt((s) => ({ ...s, status: 'loading' }))
    LISTS[name]()
      .then((d) => setSt({ status: 'ready', items: d.results || [], err: null }))
      .catch((err) => setSt({ status: 'error', items: [], err }))
  }, [name])
  useEffect(() => { if (enabled) load() }, [enabled, load])
  return [st, load]
}

function PosterCard({ m, onOpen, showDate }) {
  const sub = showDate && m.release_date
    ? new Date(m.release_date).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' })
    : [year(m.release_date), rating(m) ? `TMDB ${rating(m)}` : ''].filter(Boolean).join(' · ')
  return (
    <button className="cn-card" onClick={() => onOpen(m.id)} aria-label={`${m.title}${m.release_date ? ', ' + year(m.release_date) : ''}`}>
      {m.poster_path
        ? <img className="cn-poster" src={img(m.poster_path, 'w342')} alt="" loading="lazy" />
        : <div className="cn-poster" aria-hidden />}
      <div className="cn-card-t">{m.title}</div>
      <div className="cn-card-s">{sub}</div>
    </button>
  )
}

function Rail({ title, note, state, onRetry, onOpen, showDate, items }) {
  const list = items || state.items
  return (
    <section className="cn-section" aria-label={title}>
      <div className="cn-h"><h2 className="cn-serif">{title}</h2>{note ? <small>{note}</small> : null}</div>
      {state && state.status === 'loading' && <div className="cn-rail" aria-busy="true">{Array.from({ length: 7 }, (_, i) => <div key={i} className="cn-sk" />)}</div>}
      {state && state.status === 'error' && (
        <p className="cn-note">Couldn’t load this row.<button className="cn-retry" onClick={onRetry}>Try again</button></p>
      )}
      {(!state || state.status === 'ready') && (
        list.length
          ? <div className="cn-rail">{list.map((m) => <PosterCard key={m.id} m={m} onOpen={onOpen} showDate={showDate} />)}</div>
          : <p className="cn-note">Nothing to show here right now.</p>
      )}
    </section>
  )
}

async function shareMovie(movie, setStatus) {
  const url = `https://www.themoviedb.org/movie/${movie.id}`
  const text = `${movie.title}${movie.release_date ? ` (${year(movie.release_date)})` : ''}`
  try {
    if (navigator.share) { await navigator.share({ title: movie.title, text, url }); return }
    await navigator.clipboard.writeText(`${text} ${url}`)
    setStatus('Link copied')
  } catch (e) {
    if (e && e.name === 'AbortError') return
    setStatus('Couldn’t share that')
  }
  setTimeout(() => setStatus(''), 2500)
}

/* ── detail view ── */
function Detail({ id, onClose, onOpen, saved, onToggleSave }) {
  const [data, setData] = useState(null)
  const [err, setErr] = useState(null)
  const [trailer, setTrailer] = useState(false)
  const [status, setStatus] = useState('')
  const reduced = prefersReducedMotion()
  const topRef = useRef(null)

  useEffect(() => {
    let live = true
    setData(null); setErr(null); setTrailer(false)
    topRef.current?.scrollTo?.({ top: 0 })
    loadMovie(id).then((d) => { if (live) setData(d) }).catch((e) => { if (live) setErr(e) })
    return () => { live = false }
  }, [id])

  const movie = data?.movie
  const prov = data?.providers
  const key = movie ? trailerKey(movie) : null
  const isSaved = movie ? saved.some((s) => s.id === movie.id) : false
  const recs = (movie?.recommendations?.results || []).filter((r) => r.poster_path).slice(0, 14)
  const provGroups = prov ? [['Stream', prov.flatrate], ['Rent', prov.rent], ['Buy', prov.buy]].filter(([, l]) => l && l.length) : []

  return (
    <motion.div
      ref={topRef} className="cn-detail" role="dialog" aria-modal="false" aria-label={movie ? movie.title : 'Movie details'}
      initial={reduced ? false : { opacity: 0, y: 36 }} animate={{ opacity: 1, y: 0 }} exit={reduced ? { opacity: 0 } : { opacity: 0, y: 36 }}
      transition={reduced ? { duration: 0 } : { type: 'spring', stiffness: 260, damping: 30 }}
    >
      <button className="cn-back" onClick={onClose}><IconBack /> Back</button>

      {err && <p className="cn-note" style={{ marginTop: 70 }}>Couldn’t load this movie.<button className="cn-retry" onClick={() => setErr(null) || loadMovie(id).then(setData).catch(setErr)}>Try again</button></p>}
      {!err && !movie && <div className="cn-d-hero" aria-busy="true" />}

      {movie && (
        <>
          <div className="cn-d-hero">{movie.backdrop_path && <img src={img(movie.backdrop_path, 'w1280')} alt="" />}</div>
          <div className="cn-d-body">
            <div className="cn-d-top">
              {movie.poster_path && <img className="cn-poster" src={img(movie.poster_path, 'w500')} alt={`${movie.title} poster`} />}
              <div style={{ minWidth: 0, flex: 1 }}>
                <h1 className="cn-title cn-serif">{movie.title}</h1>
                <div className="cn-meta">
                  {movie.release_date && <span>{year(movie.release_date)}</span>}
                  {movie.runtime ? <span>{runtimeLabel(movie.runtime)}</span> : null}
                  <Rate m={movie} />
                </div>
              </div>
            </div>

            <div className="cn-chips">{(movie.genres || []).map((g) => <span key={g.id} className="cn-chip">{g.name}</span>)}</div>
            {movie.tagline ? <p className="cn-tag cn-serif">{movie.tagline}</p> : null}

            <div className="cn-actions">
              {key && <button className="cn-btn primary" onClick={() => setTrailer((t) => !t)} aria-expanded={trailer}>{trailer ? <IconClose /> : <IconPlay />} {trailer ? 'Close trailer' : 'Trailer'}</button>}
              <button className="cn-btn" aria-pressed={isSaved} onClick={() => onToggleSave(movie)}><IconBookmark filled={isSaved} /> {isSaved ? 'Saved' : 'Save'}</button>
              <button className="cn-btn" onClick={() => shareMovie(movie, setStatus)}><IconShare /> Share</button>
            </div>
            <div role="status" aria-live="polite" style={{ minHeight: 18, fontSize: 12, color: '#b8b0d6', marginTop: 6 }}>
              {status || (isSaved ? 'Saved on this device only' : '')}
            </div>

            {trailer && key && (
              <div className="cn-video">
                <iframe title={`${movie.title} trailer`} src={`https://www.youtube-nocookie.com/embed/${key}?rel=0&autoplay=1`} allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen />
              </div>
            )}

            <p className="cn-over">{movie.overview || 'No description available.'}</p>

            <h3 className="cn-sub">Cast and crew</h3>
            <div className="cn-people">
              {director(movie) && <span><b>Director</b> {director(movie)}</span>}
              {mainCast(movie, 8).map((n) => <span key={n}>{n}</span>)}
            </div>

            <h3 className="cn-sub">Where to watch in Kenya</h3>
            {provGroups.length ? (
              <>
                {provGroups.map(([label, list]) => (
                  <div key={label} style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: 12, color: '#9d97b5', margin: '0 0 6px' }}>{label}</div>
                    <div className="cn-provs">
                      {list.map((p) => (
                        <span key={p.provider_id} className="cn-prov">
                          {p.logo_path && <img src={img(p.logo_path, 'w92')} alt="" loading="lazy" />}{p.provider_name}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
                <p style={{ fontSize: 11.5, color: '#7f789a', margin: '6px 0 0' }}>Streaming data from JustWatch, via TMDB. Region: {REGION}.</p>
              </>
            ) : (
              <p style={{ fontSize: 13, color: '#b8b0d6', margin: 0 }}>No streaming information for Kenya on this title.</p>
            )}

            {recs.length > 0 && (
              <>
                <h3 className="cn-sub">Similar movies</h3>
                <div className="cn-rail" style={{ padding: '4px 0 10px' }}>{recs.map((r) => <PosterCard key={r.id} m={r} onOpen={onOpen} />)}</div>
              </>
            )}
          </div>
        </>
      )}
    </motion.div>
  )
}

/* ── browse view ── */
const SORTS = [
  { v: 'popularity.desc', l: 'Most popular' },
  { v: 'vote_average.desc', l: 'Highest rated' },
  { v: 'primary_release_date.desc', l: 'Newest' },
]

function Browse({ genreList, onOpen, onClose }) {
  const [q, setQ] = useState('')
  const [genre, setGenre] = useState('')
  const [sort, setSort] = useState('popularity.desc')
  const [state, setState] = useState({ status: 'loading', items: [], page: 0, total: 1, err: null })

  const fetchPage = useCallback((page, replace) => {
    setState((s) => ({ ...s, status: 'loading', items: replace ? [] : s.items }))
    browse({ query: q, genre, sort, page })
      .then((d) => setState((s) => ({ status: 'ready', page: d.page || page, total: d.total_pages || 1, err: null,
        items: replace ? d.results || [] : [...s.items, ...(d.results || []).filter((m) => !s.items.some((x) => x.id === m.id))] })))
      .catch((err) => setState((s) => ({ ...s, status: 'error', err })))
  }, [q, genre, sort])

  useEffect(() => {
    const t = setTimeout(() => fetchPage(1, true), q ? 400 : 0) // wait for typing to pause
    return () => clearTimeout(t)
  }, [fetchPage, q])

  return (
    <div className="cn-browse">
      <div className="cn-filters">
        <input className="cn-input" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search movies" aria-label="Search movies" autoFocus />
        <select className="cn-select" value={genre} onChange={(e) => setGenre(e.target.value)} disabled={!!q} aria-label="Genre">
          <option value="">All genres</option>
          {genreList.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
        <select className="cn-select" value={sort} onChange={(e) => setSort(e.target.value)} disabled={!!q} aria-label="Sort by">
          {SORTS.map((s) => <option key={s.v} value={s.v}>{s.l}</option>)}
        </select>
      </div>
      <div role="status" aria-live="polite">
        {state.status === 'ready' && state.items.length === 0 && <p className="cn-note" style={{ margin: '16px 0 0' }}>No movies found.</p>}
        {state.status === 'error' && <p className="cn-note" style={{ margin: '16px 0 0' }}>Couldn’t load results.<button className="cn-retry" onClick={() => fetchPage(1, true)}>Try again</button></p>}
      </div>
      <div className="cn-grid">
        {state.items.map((m) => <PosterCard key={m.id} m={m} onOpen={onOpen} />)}
        {state.status === 'loading' && state.items.length === 0 && Array.from({ length: 9 }, (_, i) => <div key={i} className="cn-sk" style={{ width: 'auto' }} />)}
      </div>
      {state.status === 'ready' && state.page < state.total && (
        <div className="cn-more"><button className="cn-btn" onClick={() => fetchPage(state.page + 1, false)}>Load more</button></div>
      )}
      <div className="cn-more" style={{ marginTop: 28 }}><button className="cn-btn" onClick={onClose}>Back to Cinema</button></div>
    </div>
  )
}

/* ── the environment ── */
export default function CinemaEnv({ ctx, active }) {
  const reduced = prefersReducedMotion()
  const [trending, retryTrending] = useList('trending', active)
  const [topRated, retryTop] = useList('topRated', active)
  const [newRel, retryNew] = useList('newReleases', active)
  const [gems, retryGems] = useList('hiddenGems', active)
  const [soon, retrySoon] = useList('comingSoon', active)
  const [popular] = useList('popular', active)

  const [genreList, setGenreList] = useState([])
  const [view, setView] = useState('home') // home | browse
  const [openId, setOpenId] = useState(null)
  const [saved, setSaved] = useState(getSaved)
  const [featIdx, setFeatIdx] = useState(0)
  const [featDetail, setFeatDetail] = useState({})
  const [status, setStatus] = useState('')

  useEffect(() => { if (active) loadGenres().then(setGenreList).catch(() => {}) }, [active])

  const genreName = useMemo(() => Object.fromEntries(genreList.map((g) => [g.id, g.name])), [genreList])
  const featured = useMemo(() => trending.items.filter((m) => m.backdrop_path).slice(0, 5), [trending.items])
  const feat = featured[Math.min(featIdx, Math.max(0, featured.length - 1))]

  // fetch runtime / cast / director for whichever film is featured
  useEffect(() => {
    if (!feat || featDetail[feat.id]) return
    let live = true
    loadMovie(feat.id).then((d) => { if (live) setFeatDetail((p) => ({ ...p, [feat.id]: d.movie })) }).catch(() => {})
    return () => { live = false }
  }, [feat, featDetail])

  const pool = useMemo(() => {
    const seen = new Set()
    return [...trending.items, ...topRated.items, ...popular.items].filter((m) => !seen.has(m.id) && seen.add(m.id))
  }, [trending.items, topRated.items, popular.items])
  const tonight = useMemo(
    () => (trending.status === 'ready' && topRated.status === 'ready' ? tonightsPick(pool, ctx.userId) : null),
    [pool, trending.status, topRated.status, ctx.userId],
  )

  const onToggleSave = (m) => setSaved(toggleSaved(m))
  const openMovie = useCallback((id) => setOpenId(id), [])

  // whole-screen states
  const fatal = trending.status === 'error' ? trending.err : null
  let fatalMsg = null
  if (fatal instanceof CinemaError) {
    if (fatal.kind === 'offline') fatalMsg = 'You’re offline. Cinema needs a connection.'
    else if (fatal.kind === 'not_configured') fatalMsg = 'Cinema isn’t set up yet. The movie service has to be deployed with a TMDB key first.'
  }
  if (fatal && !fatalMsg) fatalMsg = 'Cinema couldn’t load right now.'

  const d = feat ? featDetail[feat.id] : null
  const metaGenres = feat ? (d?.genres ? d.genres.map((g) => g.name) : (feat.genre_ids || []).map((g) => genreName[g]).filter(Boolean)).slice(0, 3) : []

  return (
    <div className="cn">
      <style>{CSS}</style>

      <div className="cn-bar">
        <span className="cn-wordmark cn-serif">Cinema</span>
        <div className="cn-bar-actions">
          <button className="cn-icon" onClick={() => setView(view === 'browse' ? 'home' : 'browse')} aria-label={view === 'browse' ? 'Close search' : 'Search and browse'}>
            {view === 'browse' ? <IconClose /> : <IconSearch />}
          </button>
        </div>
      </div>

      <div className="cn-scroll">
        {fatalMsg ? (
          <div style={{ padding: '96px 0 0' }}>
            <p className="cn-note" role="alert">{fatalMsg}<button className="cn-retry" onClick={retryTrending}>Try again</button></p>
          </div>
        ) : view === 'browse' ? (
          <Browse genreList={genreList} onOpen={openMovie} onClose={() => setView('home')} />
        ) : (
          <>
            {/* featured */}
            <section className="cn-hero" aria-label="Featured movie">
              {trending.status === 'loading' && <div className="cn-sk" style={{ position: 'absolute', inset: 0, width: 'auto', aspectRatio: 'auto', borderRadius: 0 }} aria-busy="true" />}
              <AnimatePresence initial={false} mode="sync">
                {feat && (
                  <motion.div key={feat.id} className="cn-hero-bg"
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    transition={{ duration: reduced ? 0 : 0.7, ease: 'easeOut' }}>
                    <img src={img(feat.backdrop_path, 'w1280')} alt="" />
                  </motion.div>
                )}
              </AnimatePresence>
              <div className="cn-hero-shade" />
              {feat && (
                <>
                  <div className="cn-hero-in">
                    {feat.poster_path && <img className="cn-poster" src={img(feat.poster_path, 'w500')} alt={`${feat.title} poster`} />}
                    <motion.div key={feat.id} className="cn-hero-text"
                      initial={reduced ? false : { opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: reduced ? 0 : 0.5, delay: reduced ? 0 : 0.12 }}>
                      <div className="cn-eyebrow">Featured</div>
                      <h1 className="cn-title cn-serif">{feat.title}</h1>
                      <div className="cn-meta">
                        {feat.release_date && <span>{year(feat.release_date)}</span>}
                        {d?.runtime ? <span>{runtimeLabel(d.runtime)}</span> : null}
                        {metaGenres.length ? <span>{metaGenres.join(', ')}</span> : null}
                        <Rate m={feat} />
                      </div>
                      <p className="cn-syn">{feat.overview}</p>
                      {d && (director(d) || mainCast(d).length) ? (
                        <p className="cn-crew">{director(d) ? `Directed by ${director(d)}` : ''}{director(d) && mainCast(d).length ? ' · ' : ''}{mainCast(d, 3).join(', ')}</p>
                      ) : null}
                      <div className="cn-actions">
                        <button className="cn-btn primary" onClick={() => openMovie(feat.id)}><IconPlay /> Trailer and details</button>
                        <button className="cn-btn" aria-pressed={saved.some((s) => s.id === feat.id)} onClick={() => onToggleSave(feat)}>
                          <IconBookmark filled={saved.some((s) => s.id === feat.id)} /> {saved.some((s) => s.id === feat.id) ? 'Saved' : 'Save'}
                        </button>
                        <button className="cn-btn" onClick={() => shareMovie(feat, setStatus)}><IconShare /> Share</button>
                      </div>
                      <div role="status" aria-live="polite" style={{ minHeight: 16, fontSize: 12, color: '#b8b0d6', marginTop: 4 }}>{status}</div>
                    </motion.div>
                  </div>
                  {featured.length > 1 && (
                    <div className="cn-dots" role="group" aria-label="Choose featured movie">
                      {featured.map((m, i) => (
                        <button key={m.id} className="cn-dotwrap" onClick={() => setFeatIdx(i)} aria-label={`Show ${m.title}`} aria-current={i === featIdx}>
                          <span className="cn-dot" aria-current={i === featIdx} style={{ display: 'block' }} />
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </section>

            {/* tonight's pick */}
            {tonight && (
              <section className="cn-section" aria-label="Tonight’s pick">
                <div className="cn-h"><h2 className="cn-serif">Tonight’s pick</h2><small>New one tomorrow</small></div>
                <button className="cn-tonight" onClick={() => openMovie(tonight.id)} aria-label={`Tonight’s pick: ${tonight.title}`}>
                  <img src={img(tonight.backdrop_path, 'w780')} alt="" loading="lazy" />
                  <div className="cn-tonight-in">
                    <div className="cn-title cn-serif" style={{ fontSize: 'clamp(20px,5vw,30px)' }}>{tonight.title}</div>
                    <div className="cn-meta"><span>{year(tonight.release_date)}</span><Rate m={tonight} /></div>
                  </div>
                </button>
              </section>
            )}

            <Rail title="Trending now" state={trending} onRetry={retryTrending} onOpen={openMovie} />
            <Rail title="Highest rated" state={topRated} onRetry={retryTop} onOpen={openMovie} />
            <Rail title="New releases" note="Now showing" state={newRel} onRetry={retryNew} onOpen={openMovie} />
            <Rail title="Hidden gems" note="Well rated, less talked about" state={gems} onRetry={retryGems} onOpen={openMovie} />
            <Rail title="Coming soon" state={soon} onRetry={retrySoon} onOpen={openMovie} showDate />
            {saved.length > 0 && <Rail title="Saved" note="On this device" items={saved} onOpen={openMovie} />}

            <p className="cn-foot">
              This product uses the TMDB API but is not endorsed or certified by TMDB. Ratings shown are TMDB audience ratings,
              not IMDb or Rotten Tomatoes scores.
            </p>
          </>
        )}
      </div>

      <AnimatePresence>
        {openId && (
          <Detail key="detail" id={openId} onClose={() => setOpenId(null)} onOpen={openMovie} saved={saved} onToggleSave={onToggleSave} />
        )}
      </AnimatePresence>
    </div>
  )
}
