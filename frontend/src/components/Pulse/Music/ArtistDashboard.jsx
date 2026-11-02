import React, { useState, useEffect, useCallback, useRef } from 'react'
import { motion } from 'framer-motion'
import { ArtistService, MAX_AUDIO_BYTES } from '../../../lib/music/ArtistService'
import {
  IconUpload, IconMusic, IconTrash, IconEye, IconEyeOff, IconPlay, IconPause, IconHeart, IconDownload,
  IconX, IconCheck, IconMic, IconPlus,
} from '../../Icons'
import './ArtistDashboard.css'

/**
 * components/Pulse/Music/ArtistDashboard.jsx
 *
 * Same props as before ({ userId, onClose }), plus an optional onBecomeArtist for the "no profile yet" state.
 *
 * Designed so uploading feels safe and unhurried:
 *  - Drag a song in (or browse). The file is checked straight away, with plain-language messages.
 *  - Hear it back before it goes anywhere, with its length shown.
 *  - Title is filled in from the file name; cover art and album are optional.
 *  - Publish now OR keep it as a draft that only you can see.
 *  - The button always says what is still missing instead of just being greyed out.
 *  - A failed upload never throws your file away.
 */

// @pure-start
const AUDIO_EXT = /\.(mp3|m4a|mp4|wav|ogg|oga)$/i

const isAudioFile = (f) => !!f && (/^audio\//.test(f.type || '') || AUDIO_EXT.test(f.name || ''))
const isImageFile = (f) => !!f && /^image\/(png|jpe?g|webp)$/.test(f.type || '')

function fmtBytes(n) {
  if (!Number.isFinite(n)) return ''
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`
  return `${(n / 1024 / 1024).toFixed(1).replace(/\.0$/, '')} MB`
}

function fmtDuration(sec) {
  if (!Number.isFinite(sec) || sec <= 0) return ''
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

function compact(n) {
  const v = Number(n) || 0
  if (v < 1000) return String(v)
  if (v < 1e6) return `${(v / 1000).toFixed(v < 10000 ? 1 : 0).replace(/\.0$/, '')}K`
  return `${(v / 1e6).toFixed(1).replace(/\.0$/, '')}M`
}

// "04 - my_song_final.wav" -> "My song final"
function titleFromFilename(name) {
  let t = String(name || '').replace(/\.[a-z0-9]{2,4}$/i, '')
  t = t.replace(/^\s*(?:track\s*)?\d{1,3}\s*[-_.)]+\s*/i, '')
  t = t.replace(/_+/g, ' ').replace(/\s{2,}/g, ' ').trim()
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : ''
}

function validateAudio(file, maxBytes) {
  if (!isAudioFile(file)) return "That doesn't look like an audio file. Use MP3, M4A, WAV or OGG."
  if (file.size === 0) return 'That file is empty.'
  if (maxBytes && file.size > maxBytes) return `That file is ${fmtBytes(file.size)}. The limit is ${fmtBytes(maxBytes)}.`
  return null
}

function tally(tracks) {
  return tracks.reduce(
    (a, t) => ({
      plays: a.plays + (Number(t.play_count) || 0),
      likes: a.likes + (Number(t.like_count) || 0),
      downloads: a.downloads + (Number(t.download_count) || 0),
    }),
    { plays: 0, likes: 0, downloads: 0 }
  )
}

// What still stands between the artist and a published song, in the order they will do it
function missingBits({ file, title, rights }) {
  const out = []
  if (!file) out.push('Add your song')
  if (!String(title || '').trim()) out.push('Give it a title')
  if (!rights) out.push('Confirm you have the rights')
  return out
}

function friendlyUploadError(e) {
  const m = String(e?.message || e || '')
  if (/size|too large|exceed|413|payload/i.test(m)) return 'That file is too large to upload. Try a smaller export.'
  if (/network|fetch|failed to fetch|offline|timeout/i.test(m)) return 'Connection problem. Check your internet and try again.'
  if (/mime|type|format|unsupported/i.test(m)) return "That file type wasn't accepted. Try MP3 or WAV."
  return "The upload didn't go through. Your song is still here, so just try again."
}

const isLive = (t) => t.status === 'published'
// @pure-end

/* ── small pieces ──────────────────────────────────────────────────────── */

function Stat({ icon, value, label }) {
  return (
    <div className="ad-stat">
      <span className="ad-stat-icon">{icon}</span>
      <span className="ad-stat-value">{compact(value)}</span>
      <span className="ad-stat-label">{label}</span>
    </div>
  )
}

function PreviewPlayer({ src, onDuration }) {
  const audio = useRef(null)
  const [playing, setPlaying] = useState(false)
  const [time, setTime] = useState(0)
  const [dur, setDur] = useState(0)
  const [failed, setFailed] = useState(false)

  useEffect(() => { setPlaying(false); setTime(0); setDur(0); setFailed(false) }, [src])

  const toggle = () => {
    const a = audio.current
    if (!a) return
    if (a.paused) a.play().catch(() => setFailed(true))
    else a.pause()
  }
  const seek = (e) => {
    const a = audio.current
    if (!a || !dur) return
    const r = e.currentTarget.getBoundingClientRect()
    a.currentTime = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * dur
  }

  return (
    <div className="ad-preview">
      <audio
        ref={audio}
        src={src}
        preload="metadata"
        onLoadedMetadata={(e) => { const d = e.currentTarget.duration; if (Number.isFinite(d)) { setDur(d); onDuration && onDuration(d) } }}
        onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => { setPlaying(false); setTime(0) }}
        onError={() => { setFailed(true); onDuration && onDuration(0) }}
      />
      <button type="button" className="ad-preview-btn" onClick={toggle} disabled={failed} aria-label={playing ? 'Pause preview' : 'Play preview'}>
        {playing ? <IconPause size={14} /> : <IconPlay size={14} />}
      </button>
      <div className="ad-preview-bar" onClick={seek} role="slider" aria-label="Preview position" aria-valuemin={0} aria-valuemax={Math.round(dur)} aria-valuenow={Math.round(time)}>
        <span style={{ width: dur ? `${(time / dur) * 100}%` : 0 }} />
      </div>
      <span className="ad-preview-time">{failed ? "Can't preview" : `${fmtDuration(time) || '0:00'} / ${fmtDuration(dur) || '--:--'}`}</span>
    </div>
  )
}

function Uploader({ artist, onUploaded, onBusy }) {
  const [file, setFile] = useState(null)
  const [cover, setCover] = useState(null)
  const [title, setTitle] = useState('')
  const [titleTouched, setTitleTouched] = useState(false)
  const [album, setAlbum] = useState('')
  const [visibility, setVisibility] = useState('publish') // 'publish' | 'draft'
  const [rights, setRights] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [fileError, setFileError] = useState(null)
  const [over, setOver] = useState(false)
  const [duration, setDuration] = useState(0)
  const [audioUrl, setAudioUrl] = useState(null)
  const [coverUrl, setCoverUrl] = useState(null)
  const audioInput = useRef(null)
  const coverInput = useRef(null)

  useEffect(() => { onBusy && onBusy(busy) }, [busy]) // eslint-disable-line

  useEffect(() => {
    if (!file) { setAudioUrl(null); return undefined }
    const url = URL.createObjectURL(file)
    setAudioUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  useEffect(() => {
    if (!cover) { setCoverUrl(null); return undefined }
    const url = URL.createObjectURL(cover)
    setCoverUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [cover])

  const takeAudio = (f) => {
    if (!f) return
    const problem = validateAudio(f, MAX_AUDIO_BYTES)
    if (problem) { setFileError(problem); return }
    setFileError(null)
    setError(null)
    setDuration(0)
    setFile(f)
    if (!titleTouched) setTitle(titleFromFilename(f.name))
  }

  const takeCover = (f) => {
    if (!f) return
    if (!isImageFile(f)) { setError('Cover art should be a PNG, JPG or WebP image.'); return }
    setError(null)
    setCover(f)
  }

  const onDrop = (e) => {
    e.preventDefault()
    setOver(false)
    const files = Array.from(e.dataTransfer?.files || [])
    const audio = files.find(isAudioFile) || files[0]
    takeAudio(audio)
    const image = files.find(isImageFile)
    if (image) takeCover(image)
  }

  const reset = () => {
    setFile(null); setCover(null); setTitle(''); setTitleTouched(false); setAlbum('')
    setVisibility('publish'); setRights(false); setError(null); setFileError(null); setDuration(0)
  }

  const missing = missingBits({ file, title, rights })
  const canSubmit = missing.length === 0 && !busy

  const submit = async () => {
    if (!canSubmit) return
    setBusy(true)
    setError(null)
    try {
      let track = await ArtistService.uploadTrack(artist.id, {
        title: title.trim(), album: album.trim() || null, audioFile: file, coverFile: cover,
      })
      let draftFailed = false
      if (visibility === 'draft') {
        try {
          await ArtistService.setTrackStatus(track.id, 'unpublished')
          track = { ...track, status: 'unpublished' }
        } catch {
          draftFailed = true
        }
      }
      onUploaded(track, { draft: visibility === 'draft' && !draftFailed, draftFailed })
      reset()
    } catch (e) {
      console.error('track upload failed:', e)
      setError(friendlyUploadError(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="ad-card ad-uploader" aria-label="Upload a song">
      <h3 className="ad-h">Upload a song</h3>

      {!file ? (
        <div
          className={`ad-drop${over ? ' is-over' : ''}`}
          role="button"
          tabIndex={0}
          aria-label="Choose an audio file"
          onClick={() => audioInput.current?.click()}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); audioInput.current?.click() } }}
          onDragOver={(e) => { e.preventDefault(); setOver(true) }}
          onDragLeave={() => setOver(false)}
          onDrop={onDrop}
        >
          <span className="ad-drop-bars" aria-hidden="true">
            {Array.from({ length: 21 }, (_, i) => <i key={i} style={{ '--i': i }} />)}
          </span>
          <span className="ad-drop-icon"><IconUpload size={20} /></span>
          <span className="ad-drop-title">{over ? 'Drop it here' : 'Drop your song here'}</span>
          <span className="ad-drop-sub">or <u>browse your files</u></span>
          <span className="ad-drop-hint">MP3, M4A, WAV or OGG, up to {fmtBytes(MAX_AUDIO_BYTES)}</span>
        </div>
      ) : (
        <div className="ad-file">
          <div className="ad-file-head">
            <span className="ad-file-icon"><IconMusic size={16} /></span>
            <span className="ad-file-meta">
              <span className="ad-file-name">{file.name}</span>
              <span className="ad-file-sub">{fmtBytes(file.size)}{duration ? `, ${fmtDuration(duration)}` : ''}</span>
            </span>
            <button type="button" className="ad-link" onClick={() => audioInput.current?.click()} disabled={busy}>Replace</button>
            <button type="button" className="ad-x" onClick={() => { setFile(null); setFileError(null) }} disabled={busy} aria-label="Remove song"><IconX size={14} /></button>
          </div>
          <PreviewPlayer src={audioUrl} onDuration={setDuration} />
        </div>
      )}
      <input ref={audioInput} type="file" hidden accept="audio/mpeg,audio/mp4,audio/x-m4a,audio/wav,audio/ogg,.mp3,.m4a,.wav,.ogg"
        onChange={(e) => { takeAudio(e.target.files?.[0]); e.target.value = '' }} />
      {fileError && <p className="ad-error" role="alert">{fileError}</p>}

      <div className="ad-fields">
        <div className="ad-cover-pick">
          <button type="button" className={`ad-cover${coverUrl ? ' has-img' : ''}`} onClick={() => coverInput.current?.click()} disabled={busy} aria-label={coverUrl ? 'Change cover art' : 'Add cover art'}>
            {coverUrl ? <img src={coverUrl} alt="" /> : <span><IconPlus size={18} /><em>Cover</em></span>}
          </button>
          {coverUrl && <button type="button" className="ad-link ad-link-sm" onClick={() => setCover(null)} disabled={busy}>Remove</button>}
          <input ref={coverInput} type="file" hidden accept="image/png,image/jpeg,image/webp" onChange={(e) => { takeCover(e.target.files?.[0]); e.target.value = '' }} />
        </div>
        <div className="ad-inputs">
          <label className="ad-field">
            <span>Title</span>
            <input value={title} maxLength={100} onChange={(e) => { setTitle(e.target.value); setTitleTouched(true) }} placeholder="What's it called?" disabled={busy} />
          </label>
          <label className="ad-field">
            <span>Album <em>(optional)</em></span>
            <input value={album} maxLength={100} onChange={(e) => setAlbum(e.target.value)} placeholder="Single, EP or album name" disabled={busy} />
          </label>
        </div>
      </div>

      <div className="ad-seg" role="radiogroup" aria-label="When should it go live?">
        {[['publish', 'Publish now', 'Listeners can find it right away'], ['draft', 'Keep as draft', 'Only you can see it until you publish']].map(([id, label, sub]) => (
          <button key={id} type="button" role="radio" aria-checked={visibility === id} className={visibility === id ? 'is-on' : ''} onClick={() => setVisibility(id)} disabled={busy}>
            <b>{label}</b><small>{sub}</small>
          </button>
        ))}
      </div>

      <label className="ad-check">
        <input type="checkbox" checked={rights} onChange={(e) => setRights(e.target.checked)} disabled={busy} />
        <span className="ad-check-box" aria-hidden="true"><IconCheck size={12} /></span>
        <span>I made this, or I have the right to share it.</span>
      </label>

      {error && <p className="ad-error" role="alert">{error}</p>}

      {busy && (
        <div className="ad-progress" role="status" aria-live="polite">
          <span className="ad-progress-bar"><i /></span>
          <span>Uploading “{title.trim()}” ({fmtBytes(file?.size)}). Keep this open until it finishes.</span>
        </div>
      )}

      <button type="button" className="ad-cta" onClick={submit} disabled={!canSubmit}>
        <IconUpload size={15} /> {busy ? 'Uploading…' : visibility === 'draft' ? 'Save as draft' : 'Publish song'}
      </button>
      {!busy && missing.length > 0 && <p className="ad-todo">To finish: {missing.join(', ')}.</p>}
    </section>
  )
}

function TrackCard({ track, confirming, onAskDelete, onCancelDelete, onDelete, onToggle }) {
  const live = isLive(track)
  return (
    <li className={`ad-track${live ? '' : ' is-hidden'}`}>
      <div className="ad-track-cover">
        {track.cover_url ? <img src={track.cover_url} alt="" /> : <IconMusic size={18} />}
      </div>
      <div className="ad-track-main">
        <div className="ad-track-title">
          <span>{track.title}</span>
          <em className={`ad-pill ${live ? 'is-live' : ''}`}>{live ? 'Live' : 'Hidden'}</em>
        </div>
        {track.album && <div className="ad-track-album">{track.album}</div>}
        <div className="ad-track-stats">
          <span title="Plays"><IconPlay size={11} /> {compact(track.play_count)}</span>
          <span title="Likes"><IconHeart size={11} /> {compact(track.like_count)}</span>
          <span title="Downloads"><IconDownload size={11} /> {compact(track.download_count)}</span>
        </div>
      </div>
      <div className="ad-track-actions">
        <button
          type="button"
          role="switch"
          aria-checked={live}
          aria-label={live ? `Hide ${track.title} from listeners` : `Publish ${track.title}`}
          className={`ad-switch${live ? ' is-on' : ''}`}
          onClick={() => onToggle(track)}
          title={live ? 'Visible to listeners' : 'Hidden from listeners'}
        >
          <span />
        </button>
        {confirming ? (
          <span className="ad-confirm">
            <button type="button" className="ad-danger" onClick={() => onDelete(track)}>Delete</button>
            <button type="button" className="ad-ghost" onClick={onCancelDelete}>Keep</button>
          </span>
        ) : (
          <button type="button" className="ad-icon" onClick={() => onAskDelete(track.id)} aria-label={`Delete ${track.title}`} title="Delete">
            <IconTrash size={15} />
          </button>
        )}
      </div>
    </li>
  )
}

/* ── the screen ────────────────────────────────────────────────────────── */

export default function ArtistDashboard({ userId, onClose, onBecomeArtist }) {
  const [artist, setArtist] = useState(null)
  const [tracks, setTracks] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadFailed, setLoadFailed] = useState(false)
  const [filter, setFilter] = useState('all') // all | live | hidden
  const [confirmId, setConfirmId] = useState(null)
  const [toast, setToast] = useState(null)
  const [uploading, setUploading] = useState(false)
  const toastTimer = useRef(null)

  const say = useCallback((text, kind = 'ok') => {
    setToast({ text, kind })
    clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 3200)
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    setLoadFailed(false)
    try {
      const a = await ArtistService.getMyArtistProfile(userId)
      setArtist(a)
      setTracks(a ? await ArtistService.listMyTracks(a.id) : [])
    } catch (e) {
      console.error('artist dashboard load failed:', e)
      setLoadFailed(true)
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => { load(); return () => clearTimeout(toastTimer.current) }, [load])

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape' && !uploading) onClose && onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, uploading])

  useEffect(() => {
    if (!confirmId) return undefined
    const t = setTimeout(() => setConfirmId(null), 4500)
    return () => clearTimeout(t)
  }, [confirmId])

  const handleUploaded = (track, info) => {
    setTracks((prev) => [{ like_count: 0, play_count: 0, download_count: 0, ...track }, ...prev])
    if (info.draftFailed) say(`“${track.title}” uploaded, but it is still public. Use the switch to hide it.`, 'warn')
    else say(info.draft ? `Saved “${track.title}” as a draft` : `“${track.title}” is live`)
  }

  const handleToggle = async (track) => {
    const next = isLive(track) ? 'unpublished' : 'published'
    setTracks((prev) => prev.map((t) => (t.id === track.id ? { ...t, status: next } : t)))
    try {
      await ArtistService.setTrackStatus(track.id, next)
      say(next === 'published' ? `“${track.title}” is live` : `“${track.title}” is hidden`)
    } catch {
      setTracks((prev) => prev.map((t) => (t.id === track.id ? { ...t, status: track.status } : t)))
      say("Couldn't update that song. Try again.", 'warn')
    }
  }

  const handleDelete = async (track) => {
    setConfirmId(null)
    const before = tracks
    setTracks((prev) => prev.filter((t) => t.id !== track.id))
    try {
      await ArtistService.deleteTrack(track)
      say(`Deleted “${track.title}”`)
    } catch {
      setTracks(before)
      say("Couldn't delete that song. Try again.", 'warn')
    }
  }

  const totals = tally(tracks)
  const liveCount = tracks.filter(isLive).length
  const shown = tracks.filter((t) => (filter === 'live' ? isLive(t) : filter === 'hidden' ? !isLive(t) : true))
  const avatar = artist?.avatar_url || artist?.avatarUrl || artist?.image_url || null

  return (
    <motion.div
      className="ad"
      role="dialog"
      aria-label="Artist Studio"
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 18 }}
      transition={{ duration: 0.22 }}
    >
      <div className="ad-wrap">
        <header className="ad-hero">
          <div className="ad-hero-glow" aria-hidden="true" />
          <div className="ad-avatar">{avatar ? <img src={avatar} alt="" /> : <IconMic size={26} />}</div>
          <div className="ad-hero-text">
            <span className="ad-kicker">Artist Studio</span>
            <h2>{artist ? artist.artist_name : 'Your studio'}</h2>
            {artist?.bio && <p>{artist.bio}</p>}
          </div>
          <button type="button" className="ad-close" onClick={onClose} aria-label="Close studio"><IconX size={16} /></button>
        </header>

        {loading && (
          <div className="ad-skel" aria-busy="true">
            <span /><span /><span />
          </div>
        )}

        {!loading && loadFailed && (
          <div className="ad-empty">
            <h3>Couldn't open your studio</h3>
            <p>Check your connection and try again.</p>
            <button type="button" className="ad-cta ad-cta-sm" onClick={load}>Try again</button>
          </div>
        )}

        {!loading && !loadFailed && !artist && (
          <div className="ad-empty">
            <span className="ad-empty-icon"><IconMic size={22} /></span>
            <h3>Set up your artist profile first</h3>
            <p>It takes a minute: a name, and a photo if you like. Then you can upload songs here.</p>
            {onBecomeArtist && <button type="button" className="ad-cta ad-cta-sm" onClick={onBecomeArtist}>Create my profile</button>}
          </div>
        )}

        {!loading && !loadFailed && artist && (
          <>
            <div className="ad-stats">
              <Stat icon={<IconPlay size={14} />} value={totals.plays} label="Plays" />
              <Stat icon={<IconHeart size={14} />} value={totals.likes} label="Likes" />
              <Stat icon={<IconDownload size={14} />} value={totals.downloads} label="Downloads" />
              <Stat icon={<IconMusic size={14} />} value={liveCount} label={liveCount === 1 ? 'Live song' : 'Live songs'} />
            </div>

            <div className="ad-grid">
              <Uploader artist={artist} onUploaded={handleUploaded} onBusy={setUploading} />

              <section className="ad-songs" aria-label="Your songs">
                <div className="ad-songs-head">
                  <h3 className="ad-h">Your songs</h3>
                  {tracks.length > 0 && (
                    <div className="ad-tabs" role="tablist">
                      {[['all', 'All', tracks.length], ['live', 'Live', liveCount], ['hidden', 'Hidden', tracks.length - liveCount]].map(([id, label, n]) => (
                        <button key={id} type="button" role="tab" aria-selected={filter === id} className={filter === id ? 'is-on' : ''} onClick={() => setFilter(id)}>
                          {label} <em>{n}</em>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {tracks.length === 0 ? (
                  <div className="ad-first">
                    <h4>Your first song starts here</h4>
                    <ol>
                      <li><b>1</b><span>Drop in a track. We'll play it back so you can check it.</span></li>
                      <li><b>2</b><span>Add a cover and a title. Both are easy to change later.</span></li>
                      <li><b>3</b><span>Publish it, or save it as a draft and decide later.</span></li>
                    </ol>
                  </div>
                ) : shown.length === 0 ? (
                  <p className="ad-none">No {filter === 'live' ? 'live' : 'hidden'} songs.</p>
                ) : (
                  <ul className="ad-tracks">
                    {shown.map((t) => (
                      <TrackCard
                        key={t.id}
                        track={t}
                        confirming={confirmId === t.id}
                        onAskDelete={setConfirmId}
                        onCancelDelete={() => setConfirmId(null)}
                        onDelete={handleDelete}
                        onToggle={handleToggle}
                      />
                    ))}
                  </ul>
                )}
              </section>
            </div>
          </>
        )}
      </div>

      {toast && <div className={`ad-toast is-${toast.kind}`} role="status">{toast.text}</div>}
    </motion.div>
  )
}
