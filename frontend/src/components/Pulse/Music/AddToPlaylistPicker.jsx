import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useMusicPlayer } from '../../context/MusicPlayerContext'
import { PlaylistService } from '../../../lib/music/PlaylistService'
import { IconPlus, IconListMusic, IconCheck, IconHeart, IconSearch, IconMusic } from '../../Icons'
import './AddToPlaylistPicker.css'

/**
 * components/Pulse/Music/AddToPlaylistPicker.jsx
 *
 * Rendered inside TrackRail's "···" menu. Same props as before ({ track, onDone }).
 *
 * What it does, and why (from how Spotify's picker is used and what people complain about):
 *  - Several playlists in one visit, then "Done": people hate reopening the menu for every playlist.
 *  - "Liked Songs" is its own heart row, kept apart from playlist checkmarks, because mixing
 *    "liked" with "in a playlist" is the thing Spotify users found most confusing.
 *  - Clear "Already in this playlist" feedback instead of a silent duplicate.
 *  - Search appears once you have more than a handful of playlists, and your last-used playlist
 *    floats to the top (most people add several songs to the same one).
 *  - "New playlist" is the first row and creates + adds in one step, named "My Playlist #N" if you type nothing.
 *  - Keyboard: arrows move, Enter adds, Escape backs out.
 *
 * Optional prop: alreadyIn = [playlistId, ...] shows those playlists as already containing the song.
 */

// @pure-start
const SEARCH_THRESHOLD = 5

const hueOf = (s) => {
  let h = 0
  for (const ch of String(s || '')) h = (h * 31 + ch.charCodeAt(0)) % 360
  return h
}

// A stable colourful cover for playlists that have no artwork of their own
const coverGradient = (name) => {
  const h = hueOf(name)
  return `linear-gradient(135deg, hsl(${h} 68% 58%), hsl(${(h + 52) % 360} 70% 36%))`
}

const coverUrlOf = (p) => p?.cover_url || p?.coverUrl || p?.cover || p?.artwork || p?.image_url || null

const countOf = (p, bump = 0) => {
  const n = p?.track_count ?? p?.trackCount ?? p?.tracks_count ?? (Array.isArray(p?.tracks) ? p.tracks.length : null)
  if (n === null || n === undefined || Number.isNaN(Number(n))) return null
  return Number(n) + bump
}

const songsLabel = (n) => (n === null ? 'Playlist' : n === 1 ? '1 song' : `${n} songs`)

const isDuplicateError = (err) => err?.code === '23505' || /duplicate|already/i.test(String(err?.message || ''))

// Same default Spotify uses
const defaultName = (existingCount) => `My Playlist #${existingCount + 1}`

// Last-used first, then optionally narrowed by the search box
function orderPlaylists(list, lastId, query) {
  const q = String(query || '').trim().toLowerCase()
  const sorted = [...list].sort((a, b) => (a.id === lastId ? -1 : b.id === lastId ? 1 : 0))
  return q ? sorted.filter((p) => String(p.name || '').toLowerCase().includes(q)) : sorted
}

function suggestNames(track) {
  const out = []
  if (track?.artist) out.push(`${String(track.artist).slice(0, 24)} essentials`)
  out.push('Late night', 'Gym')
  return out.slice(0, 3)
}
// @pure-end

/* ── presentational part: everything it shows comes in as props ─────────── */

export function PickerView(props) {
  const {
    track, loading, loadFailed, playlists, totalCount, query, lastId, getState, getCount, liked, active,
    creating, newName, createBusy, defaultNameText, suggestions, toast, anyAdded, showSearch,
    onQuery, onRetry, onToggleLiked, onAdd, onHover, onStartCreate, onCancelCreate, onNewName, onSubmitNew,
    onDone, rootRef, onKeyDown,
  } = props

  const searching = query.trim().length > 0
  const offset = searching ? 0 : 1 // the Liked row takes slot 0 when it is shown

  return (
    <div className="atp" ref={rootRef} tabIndex={-1} onKeyDown={onKeyDown}>
      <div className="atp-head">
        <span className="atp-art">
          {track?.artwork ? <img src={track.artwork} alt="" /> : <IconMusic size={15} />}
        </span>
        <span className="atp-head-text">
          <span className="atp-kicker">Add to playlist</span>
          <span className="atp-song">{track?.title || 'This song'}</span>
        </span>
      </div>

      {showSearch && (
        <label className="atp-search">
          <IconSearch size={13} />
          <input
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            placeholder="Find a playlist"
            aria-label="Find a playlist"
            autoComplete="off"
          />
        </label>
      )}

      <div className="atp-list" role="listbox" aria-label="Your playlists">
        {creating ? (
          <div className="atp-new">
            <input
              className="atp-new-input"
              autoFocus
              value={newName}
              maxLength={60}
              placeholder={defaultNameText}
              aria-label="Playlist name"
              onChange={(e) => onNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') { e.preventDefault(); onSubmitNew() }
                if (e.key === 'Escape') { e.stopPropagation(); onCancelCreate() }
              }}
            />
            <div className="atp-chips">
              {suggestions.map((s) => (
                <button key={s} type="button" className="atp-chip" onClick={() => onNewName(s)}>{s}</button>
              ))}
            </div>
            <div className="atp-new-actions">
              <button type="button" className="atp-ghost" onClick={onCancelCreate}>Cancel</button>
              <button type="button" className="atp-primary" onClick={onSubmitNew} disabled={createBusy}>
                {createBusy ? 'Creating…' : 'Create and add'}
              </button>
            </div>
          </div>
        ) : (
          <button type="button" className="atp-row atp-row-new" onClick={onStartCreate}>
            <span className="atp-cover atp-cover-new"><IconPlus size={16} /></span>
            <span className="atp-meta">
              <span className="atp-name">New playlist</span>
              <span className="atp-sub">Create one and add this song</span>
            </span>
          </button>
        )}

        {!searching && (
          <button
            type="button"
            role="option"
            aria-selected={liked}
            className={`atp-row${active === 0 ? ' is-active' : ''}${liked ? ' is-liked' : ''}`}
            onMouseEnter={() => onHover(0)}
            onClick={onToggleLiked}
          >
            <span className="atp-cover atp-cover-liked"><IconHeart size={16} style={{ fill: liked ? 'currentColor' : 'none' }} /></span>
            <span className="atp-meta">
              <span className="atp-name">Liked Songs</span>
              <span className="atp-sub">{liked ? 'Saved to your likes' : 'Save to your likes'}</span>
            </span>
            <span className={`atp-act atp-act-heart${liked ? ' is-on' : ''}`} aria-hidden="true">
              {liked ? <IconCheck size={14} /> : <IconPlus size={14} />}
            </span>
          </button>
        )}

        {loading && (
          <>
            {[0, 1, 2].map((i) => (
              <div key={i} className="atp-skel" aria-hidden="true">
                <span className="atp-skel-cover" />
                <span className="atp-skel-lines"><span /><span /></span>
              </div>
            ))}
          </>
        )}

        {!loading && loadFailed && (
          <div className="atp-note">
            Couldn't load your playlists.
            <button type="button" className="atp-link" onClick={onRetry}>Try again</button>
          </div>
        )}

        {!loading && !loadFailed && totalCount === 0 && (
          <div className="atp-note">No playlists yet. Make your first one above.</div>
        )}

        {!loading && !loadFailed && totalCount > 0 && playlists.length === 0 && (
          <div className="atp-note">
            Nothing called “{query.trim()}”.
            <button type="button" className="atp-link" onClick={() => { onNewName(query.trim()); onStartCreate() }}>
              Create it
            </button>
          </div>
        )}

        {!loading && playlists.map((pl, i) => {
          const st = getState(pl.id)
          const done = st === 'added' || st === 'exists'
          const cover = coverUrlOf(pl)
          const count = getCount(pl)
          const idx = i + offset
          return (
            <button
              key={pl.id}
              type="button"
              role="option"
              aria-selected={done}
              aria-disabled={st === 'adding' || done}
              className={`atp-row is-${st || 'idle'}${active === idx ? ' is-active' : ''}`}
              onMouseEnter={() => onHover(idx)}
              onClick={() => onAdd(pl)}
            >
              <span className="atp-cover" style={cover ? undefined : { background: coverGradient(pl.name) }}>
                {cover
                  ? <img src={cover} alt="" />
                  : (pl.name ? <span className="atp-initial">{String(pl.name).trim().charAt(0).toUpperCase()}</span> : <IconListMusic size={16} />)}
              </span>
              <span className="atp-meta">
                <span className="atp-name">
                  {pl.name}
                  {pl.id === lastId && st !== 'added' && <span className="atp-tag">Last used</span>}
                </span>
                <span className="atp-sub">
                  {st === 'exists' ? 'Already in this playlist'
                    : st === 'error' ? "Couldn't add. Tap to retry"
                    : st === 'added' ? 'Added'
                    : songsLabel(count)}
                </span>
              </span>
              <span className="atp-act" aria-hidden="true">
                {st === 'adding' ? <span className="atp-spin" />
                  : done ? <IconCheck size={14} />
                  : st === 'error' ? <span className="atp-bang">!</span>
                  : <IconPlus size={14} />}
              </span>
            </button>
          )
        })}
      </div>

      {anyAdded && !creating && (
        <div className="atp-foot">
          <button type="button" className="atp-done" onClick={onDone}>Done</button>
        </div>
      )}

      <div className="atp-live" aria-live="polite">{toast ? toast.text : ''}</div>
      {toast && (
        <div className={`atp-toast is-${toast.kind}`} role="status">
          {toast.kind === 'ok' && <IconCheck size={13} />}
          <span>{toast.text}</span>
        </div>
      )}
    </div>
  )
}

/* ── the part that talks to the services ───────────────────────────────── */

export default function AddToPlaylistPicker({ track, onDone, alreadyIn = [] }) {
  const { userId, isLiked, toggleLike } = useMusicPlayer()

  const [playlists, setPlaylists] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadFailed, setLoadFailed] = useState(false)
  const [query, setQuery] = useState('')
  const [rows, setRows] = useState({})     // playlistId -> 'adding' | 'added' | 'exists' | 'error'
  const [bumps, setBumps] = useState({})   // playlistId -> songs added just now, for the live count
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [createBusy, setCreateBusy] = useState(false)
  const [toast, setToast] = useState(null) // { text, kind: 'ok' | 'info' | 'error' }
  const [active, setActive] = useState(0)
  const [lastId, setLastId] = useState(null)

  const rootRef = useRef(null)
  const mounted = useRef(true)
  const toastTimer = useRef(null)
  const doneTimer = useRef(null)
  const lastKey = `mattchat:music:lastPlaylist:${userId}`

  const setRow = (id, state) => setRows((r) => ({ ...r, [id]: state }))

  const showToast = useCallback((text, kind = 'ok') => {
    setToast({ text, kind })
    clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => { if (mounted.current) setToast(null) }, 2400)
  }, [])

  const load = useCallback(async () => {
    if (!userId) { setLoading(false); return }
    setLoading(true)
    setLoadFailed(false)
    try {
      const list = await PlaylistService.listPlaylists(userId)
      if (mounted.current) setPlaylists(Array.isArray(list) ? list : [])
    } catch {
      if (mounted.current) { setPlaylists([]); setLoadFailed(true) }
    } finally {
      if (mounted.current) setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    mounted.current = true
    load()
    return () => {
      mounted.current = false
      clearTimeout(toastTimer.current)
      clearTimeout(doneTimer.current)
    }
  }, [load])

  useEffect(() => {
    try { setLastId(localStorage.getItem(lastKey)) } catch { /* private mode */ }
  }, [lastKey])

  const remember = (id) => {
    try { localStorage.setItem(lastKey, id) } catch { /* private mode */ }
    setLastId(id)
  }

  const getState = (id) => rows[id] || (alreadyIn.includes(id) ? 'exists' : null)

  const ordered = orderPlaylists(playlists, lastId, query)
  const searching = query.trim().length > 0
  const liked = !!track && isLiked(track.id)
  const keyCount = ordered.length + (searching ? 0 : 1)

  useEffect(() => { setActive(0) }, [query])
  useEffect(() => {
    rootRef.current?.querySelector('.atp-row.is-active')?.scrollIntoView({ block: 'nearest' })
  }, [active])

  const onToggleLiked = () => {
    if (!track) return
    toggleLike(track)
    showToast(liked ? 'Removed from Liked Songs' : 'Saved to Liked Songs', liked ? 'info' : 'ok')
  }

  const add = async (pl) => {
    const st = getState(pl.id)
    if (st === 'adding' || st === 'added' || st === 'exists') return
    setRow(pl.id, 'adding')
    try {
      await PlaylistService.addTrack(pl.id, track)
      if (!mounted.current) return
      setRow(pl.id, 'added')
      setBumps((b) => ({ ...b, [pl.id]: (b[pl.id] || 0) + 1 }))
      remember(pl.id)
      showToast(`Added to ${pl.name}`)
    } catch (err) {
      if (!mounted.current) return
      if (isDuplicateError(err)) {
        setRow(pl.id, 'exists')
        showToast(`Already in ${pl.name}`, 'info')
      } else {
        setRow(pl.id, 'error')
        showToast("Couldn't add that song. Tap the playlist to retry.", 'error')
      }
    }
  }

  const submitNew = async () => {
    if (createBusy || !track) return
    const name = newName.trim() || defaultName(playlists.length)
    setCreateBusy(true)
    let created
    try {
      created = await PlaylistService.createPlaylist(userId, name)
    } catch {
      if (mounted.current) { setCreateBusy(false); showToast("Couldn't create the playlist. Try again.", 'error') }
      return
    }
    if (!mounted.current) return
    const playlist = { ...created, name: created?.name || name, track_count: created?.track_count ?? 0 }
    setPlaylists((prev) => [playlist, ...prev])
    setCreating(false)
    setNewName('')
    setCreateBusy(false)
    setRow(playlist.id, 'adding')
    try {
      await PlaylistService.addTrack(playlist.id, track)
      if (!mounted.current) return
      setRow(playlist.id, 'added')
      setBumps((b) => ({ ...b, [playlist.id]: 1 }))
      remember(playlist.id)
      showToast(`Created “${playlist.name}” and added the song`)
      doneTimer.current = setTimeout(() => { if (mounted.current && onDone) onDone() }, 1100)
    } catch {
      if (!mounted.current) return
      setRow(playlist.id, 'error')
      showToast('Playlist created, but the song was not added. Tap it to retry.', 'error')
    }
  }

  const activate = (index) => {
    if (!searching && index === 0) { onToggleLiked(); return }
    const pl = ordered[index - (searching ? 0 : 1)]
    if (pl) add(pl)
  }

  const onKeyDown = (e) => {
    if (creating) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((i) => Math.min(keyCount - 1, i + 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => Math.max(0, i - 1)) }
    else if (e.key === 'Enter' && e.target.tagName !== 'BUTTON') { e.preventDefault(); activate(active) }
    else if (e.key === 'Escape') {
      if (query) { e.stopPropagation(); setQuery('') } else if (onDone) onDone()
    }
  }

  if (!userId) {
    return <div className="atp atp-signed-out">Sign in to use playlists</div>
  }

  return (
    <PickerView
      track={track}
      loading={loading}
      loadFailed={loadFailed}
      playlists={ordered}
      totalCount={playlists.length}
      query={query}
      lastId={lastId}
      getState={getState}
      getCount={(pl) => countOf(pl, bumps[pl.id] || 0)}
      liked={liked}
      active={active}
      creating={creating}
      newName={newName}
      createBusy={createBusy}
      defaultNameText={defaultName(playlists.length)}
      suggestions={suggestNames(track)}
      toast={toast}
      anyAdded={Object.values(rows).includes('added')}
      showSearch={playlists.length > SEARCH_THRESHOLD}
      onQuery={setQuery}
      onRetry={load}
      onToggleLiked={onToggleLiked}
      onAdd={add}
      onHover={setActive}
      onStartCreate={() => setCreating(true)}
      onCancelCreate={() => { setCreating(false); setNewName('') }}
      onNewName={setNewName}
      onSubmitNew={submitNew}
      onDone={onDone}
      rootRef={rootRef}
      onKeyDown={onKeyDown}
    />
  )
}
