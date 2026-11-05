import React, { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ArtistService, MAX_AUDIO_BYTES } from '../../../lib/music/ArtistService'
import {
  IconUpload, IconMusic, IconTrash, IconPlay, IconPause, IconHeart, IconDownload,
  IconX, IconCheck, IconMic, IconPlus, IconSparkles, IconTrendingUp,
} from '../../Icons'
import './ArtistDashboard.css'

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
  if (v < 1e6) return `${(v / 1000).toFixed(v < 100000 ? 1 : 0).replace(/\.0$/, '')}K`
  return `${(v / 1e6).toFixed(1).replace(/\.0$/, '')}M`
}

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
  return (tracks || []).reduce(
    (a, t) => ({
      plays: a.plays + (Number(t.play_count) || 0),
      likes: a.likes + (Number(t.like_count) || 0),
      downloads: a.downloads + (Number(t.download_count) || 0),
    }),
    { plays: 0, likes: 0, downloads: 0 }
  )
}

function missingBits({ file, title, rights }) {
  const out = []
  if (!file) out.push('Add your song')
  if (!String(title || '').trim()) out.push('Give it a title')
  if (!rights) out.push('Confirm rights')
  return out
}

function friendlyUploadError(e) {
  const m = String(e?.message || e || '')
  if (/size|too large|exceed|413|payload/i.test(m)) return 'That file is too large to upload. Try a smaller export.'
  if (/network|fetch|failed to fetch|offline|timeout|cors/i.test(m)) return 'Connection blocked or CORS restriction. Check network.'
  if (/mime|type|format|unsupported/i.test(m)) return "That file type wasn't accepted. Try MP3 or WAV."
  return "The upload didn't go through. Your song is still here, so just try again."
}

const isLive = (t) => t.status === 'published'

function Stat({ icon, value, label, trend }) {
  return (
    <motion.div whileHover={{ y: -3, scale: 1.02 }} transition={{ duration: 0.2 }} className="ad-stat">
      <div className="ad-stat-header">
        <span className="ad-stat-icon">{icon}</span>
        {trend && <span className="ad-stat-trend"><IconTrendingUp size={12} /> {trend}</span>}
      </div>
      <span className="ad-stat-value">{compact(value)}</span>
      <span className="ad-stat-label">{label}</span>
    </motion.div>
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
  const [visibility, setVisibility] = useState('publish')
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

  useEffect(() => { onBusy && onBusy(busy) }, [busy, onBusy])

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
    <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="ad-card ad-uploader">
      <div className="ad-uploader-header">
        <h3 className="ad-h"><IconSparkles size={16} className="ad-sparkle-icon" /> Release New Track</h3>
        <span className="ad-badge-pro">Studio HQ</span>
      </div>

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
          <div className="ad-drop-bars" aria-hidden="true">
            {Array.from({ length: 24 }, (_, i) => <i key={i} style={{ '--i': i }} />)}
          </div>
          <div className="ad-drop-glow" />
          <span className="ad-drop-icon"><IconUpload size={22} /></span>
          <span className="ad-drop-title">{over ? 'Drop it right here!' : 'Drag & drop your audio master'}</span>
          <span className="ad-drop-sub">or <u className="ad-browse-link">browse from computer</u></span>
          <span className="ad-drop-hint">Supports MP3, M4A, WAV, OGG (Up to {fmtBytes(MAX_AUDIO_BYTES)})</span>
        </div>
      ) : (
        <div className="ad-file">
          <div className="ad-file-head">
            <span className="ad-file-icon"><IconMusic size={16} /></span>
            <span className="ad-file-meta">
              <span className="ad-file-name">{file.name}</span>
              <span className="ad-file-sub">{fmtBytes(file.size)}{duration ? ` • ${fmtDuration(duration)}` : ''}</span>
            </span>
            <button type="button" className="ad-link" onClick={() => audioInput.current?.click()} disabled={busy}>Change</button>
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
            {coverUrl ? <img src={coverUrl} alt="" /> : <span><IconPlus size={18} /><em>Artwork</em></span>}
          </button>
          {coverUrl && <button type="button" className="ad-link ad-link-sm" onClick={() => setCover(null)} disabled={busy}>Remove</button>}
          <input ref={coverInput} type="file" hidden accept="image/png,image/jpeg,image/webp" onChange={(e) => { takeCover(e.target.files?.[0]); e.target.value = '' }} />
        </div>
        <div className="ad-inputs">
          <label className="ad-field">
            <span>Track Title</span>
            <input value={title} maxLength={100} onChange={(e) => { setTitle(e.target.value); setTitleTouched(true) }} placeholder="e.g. Nairobi Sunset" disabled={busy} />
          </label>
          <label className="ad-field">
            <span>Album / EP <em>(optional)</em></span>
            <input value={album} maxLength={100} onChange={(e) => setAlbum(e.target.value)} placeholder="e.g. Genesis LP" disabled={busy} />
          </label>
        </div>
      </div>

      <div className="ad-seg" role="radiogroup" aria-label="When should it go live?">
        {[['publish', 'Publish Now', 'Reaches listeners instantly'], ['draft', 'Save as Draft', 'Private until you decide']].map(([id, label, sub]) => (
          <button key={id} type="button" role="radio" aria-checked={visibility === id} className={visibility === id ? 'is-on' : ''} onClick={() => setVisibility(id)} disabled={busy}>
            <b>{label}</b><small>{sub}</small>
          </button>
        ))}
      </div>

      <label className="ad-check">
        <input type="checkbox" checked={rights} onChange={(e) => setRights(e.target.checked)} disabled={busy} />
        <span className="ad-check-box" aria-hidden="true"><IconCheck size={12} /></span>
        <span>I own all rights or have explicit permission to distribute this audio.</span>
      </label>

      {error && <p className="ad-error" role="alert">{error}</p>}

      {busy && (
        <div className="ad-progress" role="status" aria-live="polite">
          <span className="ad-progress-bar"><i /></span>
          <span>Uploading “{title.trim()}” ({fmtBytes(file?.size)}). Keep this window open.</span>
        </div>
      )}

      <motion.button whileTap={{ scale: 0.98 }} type="button" className="ad-cta" onClick={submit} disabled={!canSubmit}>
        <IconUpload size={16} /> {busy ? 'Uploading Master…' : visibility === 'draft' ? 'Save Private Draft' : 'Launch Song Live 🚀'}
      </motion.button>
      {!busy && missing.length > 0 && <p className="ad-todo">Required before launch: <b>{missing.join(', ')}</b>.</p>}
    </motion.section>
  )
}

function TrackCard({ track, confirming, onAskDelete, onCancelDelete, onDelete, onToggle }) {
  const live = isLive(track)
  return (
    <motion.li layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }} className={`ad-track${live ? '' : ' is-hidden'}`}>
      <div className="ad-track-cover">
        {track.cover_url ? <img src={track.cover_url} alt="" /> : <IconMusic size={18} />}
      </div>
      <div className="ad-track-main">
        <div className="ad-track-title">
          <span>{track.title}</span>
          <em className={`ad-pill ${live ? 'is-live' : ''}`}>{live ? '● Live' : '○ Hidden'}</em>
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
          title={live ? 'Visible in radio feed' : 'Hidden from feed'}
        >
          <span />
        </button>
        {confirming ? (
          <span className="ad-confirm">
            <button type="button" className="ad-danger" onClick={() => onDelete(track)}>Delete</button>
            <button type="button" className="ad-ghost" onClick={onCancelDelete}>Keep</button>
          </span>
        ) : (
          <button type="button" className="ad-icon" onClick={() => onAskDelete(track.id)} aria-label={`Delete ${track.title}`} title="Delete track">
            <IconTrash size={15} />
          </button>
        )}
      </div>
    </motion.li>
  )
}

export default function ArtistDashboard({ userId, onClose, onBecomeArtist }) {
  const [artist, setArtist] = useState(null)
  const [tracks, setTracks] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadFailed, setLoadFailed] = useState(false)
  const [filter, setFilter] = useState('all')
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
      const a = await ArtistService.getMyArtistProfile(userId).catch(() => null)
      setArtist(a)
      const tList = a ? await ArtistService.listMyTracks(a.id).catch(() => []) : []
      setTracks(tList)
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
    if (info.draftFailed) say(`“${track.title}” uploaded, but status couldn't be saved as draft. Toggle it manually.`, 'warn')
    else say(info.draft ? `Saved “${track.title}” as draft` : `“${track.title}” is now streaming live! 🔥`)
  }

  const handleToggle = async (track) => {
    const next = isLive(track) ? 'unpublished' : 'published'
    setTracks((prev) => prev.map((t) => (t.id === track.id ? { ...t, status: next } : t)))
    try {
      await ArtistService.setTrackStatus(track.id, next)
      say(next === 'published' ? `“${track.title}” is live` : `“${track.title}” is hidden`)
    } catch {
      setTracks((prev) => prev.map((t) => (t.id === track.id ? { ...t, status: track.status } : t)))
      say("Couldn't update song status. Try again.", 'warn')
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
      initial={{ opacity: 0, scale: 0.98, y: 12 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.98, y: 12 }}
      transition={{ duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
    >
      <div className="ad-wrap">
        <header className="ad-hero">
          <div className="ad-hero-glow" aria-hidden="true" />
          <div className="ad-avatar">
            {avatar ? <img src={avatar} alt="" /> : <IconMic size={24} />}
          </div>
          <div className="ad-hero-text">
            <span className="ad-kicker"><IconSparkles size={12} /> Creator Control Center</span>
            <h2>{artist ? artist.artist_name : 'Artist Studio'}</h2>
            <p>{artist?.bio || 'Manage your catalog, analyze engagement, and drop fresh releases.'}</p>
          </div>
          <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} type="button" className="ad-close" onClick={onClose} aria-label="Close studio">
            <IconX size={18} />
          </motion.button>
        </header>

        {loading && (
          <div className="ad-skel-wrap" aria-busy="true">
            <div className="ad-skel"><span /><span /><span /><span /></div>
          </div>
        )}

        {!loading && loadFailed && (
          <div className="ad-empty">
            <div className="ad-empty-icon"><IconMic size={24} /></div>
            <h3>Couldn't connect to studio</h3>
            <p>Check your connection and try refreshing your session.</p>
            <button type="button" className="ad-cta ad-cta-sm" onClick={load}>Try Again</button>
          </div>
        )}

        {!loading && !loadFailed && !artist && (
          <div className="ad-empty">
            <div className="ad-empty-icon"><IconMic size={24} /></div>
            <h3>Launch Your Creator Profile</h3>
            <p>Claim your artist identity with a stage name and optional photo to start dropping tracks into Mattchat Radio.</p>
            {onBecomeArtist && <button type="button" className="ad-cta ad-cta-sm" onClick={onBecomeArtist}>Set Up Artist Profile</button>}
          </div>
        )}

        {!loading && !loadFailed && artist && (
          <>
            <div className="ad-stats">
              <Stat icon={<IconPlay size={14} />} value={totals.plays} label="Total Streams" trend="+12%" />
              <Stat icon={<IconHeart size={14} />} value={totals.likes} label="Fan Likes" trend="+5%" />
              <Stat icon={<IconDownload size={14} />} value={totals.downloads} label="Downloads" />
              <Stat icon={<IconMusic size={14} />} value={liveCount} label={liveCount === 1 ? 'Live Track' : 'Live Tracks'} />
            </div>

            <div className="ad-grid">
              <Uploader artist={artist} onUploaded={handleUploaded} onBusy={setUploading} />

              <section className="ad-songs" aria-label="Your songs">
                <div className="ad-songs-head">
                  <h3 className="ad-h">Catalog Management</h3>
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
                  <div className="ad-none-card">
                    <IconMusic size={32} className="ad-none-icon" />
                    <h4>Your catalog is waiting</h4>
                    <p>Upload your first song using the uploader on the left to start streaming across Mattchat.</p>
                  </div>
                ) : shown.length === 0 ? (
                  <p className="ad-none">No {filter === 'live' ? 'live' : 'hidden'} tracks found.</p>
                ) : (
                  <AnimatePresence>
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
                  </AnimatePresence>
                )}
              </section>
            </div>
          </>
        )}
      </div>

      {toast && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className={`ad-toast is-${toast.kind}`} role="status">
          {toast.text}
        </motion.div>
      )}
    </motion.div>
  )
}
