import React, { useState, useEffect, useCallback } from 'react'
import { ArtistService, MAX_AUDIO_BYTES } from '../../../lib/music/ArtistService'
import { IconUpload, IconMusic, IconTrash, IconEye, IconEyeOff, IconPlay, IconHeart, IconDownload, IconX } from '../../Icons'

function StatPill({ icon: Icon, value, label }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--text-muted)' }}>
      <Icon size={12} /> {value} <span style={{ opacity: 0.7 }}>{label}</span>
    </div>
  )
}

function UploadForm({ artist, onUploaded }) {
  const [title, setTitle] = useState('')
  const [album, setAlbum] = useState('')
  const [audioFile, setAudioFile] = useState(null)
  const [coverFile, setCoverFile] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const handleUpload = async () => {
    if (!title.trim() || !audioFile) { setError('Title and an audio file are required'); return }
    if (audioFile.size > MAX_AUDIO_BYTES) { setError('Audio files are limited to 25MB'); return }
    setBusy(true)
    setError(null)
    try {
      const track = await ArtistService.uploadTrack(artist.id, { title, album: album || null, audioFile, coverFile })
      setTitle(''); setAlbum(''); setAudioFile(null); setCoverFile(null)
      onUploaded(track)
    } catch (e) {
      setError(e.message || 'Upload failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ background: 'var(--bg-surface-2)', border: '1px solid var(--border)', borderRadius: 14, padding: 16, marginBottom: 20 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12 }}>Upload a track</div>
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Track title"
        style={{ width: '100%', marginBottom: 8, padding: '9px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-surface-1)', color: 'var(--text-primary)', fontSize: 13 }} />
      <input value={album} onChange={(e) => setAlbum(e.target.value)} placeholder="Album (optional)"
        style={{ width: '100%', marginBottom: 8, padding: '9px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-surface-1)', color: 'var(--text-primary)', fontSize: 13 }} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
        <label style={{ fontSize: 11, color: 'var(--text-muted)' }}>Audio file (MP3/M4A/WAV/OGG, max 25MB)</label>
        <input type="file" accept="audio/mpeg,audio/mp4,audio/x-m4a,audio/wav,audio/ogg" onChange={(e) => setAudioFile(e.target.files?.[0] || null)} style={{ fontSize: 12, color: 'var(--text-muted)' }} />
        <label style={{ fontSize: 11, color: 'var(--text-muted)' }}>Cover art (optional)</label>
        <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => setCoverFile(e.target.files?.[0] || null)} style={{ fontSize: 12, color: 'var(--text-muted)' }} />
      </div>
      {error && <div style={{ fontSize: 12, color: '#f87171', marginBottom: 8 }}>{error}</div>}
      <button onClick={handleUpload} disabled={busy}
        style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 700, color: '#fff', background: 'linear-gradient(135deg,#a78bfa,#6c63ff)', border: 'none', borderRadius: 10, padding: '9px 16px', cursor: 'pointer', opacity: busy ? 0.7 : 1 }}>
        <IconUpload size={13} /> {busy ? 'Uploading…' : 'Publish track'}
      </button>
    </div>
  )
}

export default function ArtistDashboard({ userId, onClose }) {
  const [artist, setArtist] = useState(null)
  const [tracks, setTracks] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const a = await ArtistService.getMyArtistProfile(userId)
    setArtist(a)
    if (a) setTracks(await ArtistService.listMyTracks(a.id))
    setLoading(false)
  }, [userId])

  useEffect(() => { load() }, [load])

  const handleToggleStatus = async (track) => {
    const next = track.status === 'published' ? 'unpublished' : 'published'
    setTracks((prev) => prev.map((t) => (t.id === track.id ? { ...t, status: next } : t)))
    try { await ArtistService.setTrackStatus(track.id, next) } catch { load() }
  }

  const handleDelete = async (track) => {
    setTracks((prev) => prev.filter((t) => t.id !== track.id))
    try { await ArtistService.deleteTrack(track) } catch { load() }
  }

  if (loading) return null

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 750, background: 'var(--bg-surface-1, #0f0f1a)', overflowY: 'auto' }}>
      <div style={{ maxWidth: 640, margin: '0 auto', padding: 16, paddingBottom: 100 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
            {artist ? artist.artist_name : 'Artist Studio'}
          </h2>
          <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: '50%', border: 'none', cursor: 'pointer', background: 'var(--bg-surface-2)', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <IconX size={15} />
          </button>
        </div>

        {artist && <UploadForm artist={artist} onUploaded={(t) => setTracks((prev) => [{ ...t, like_count: 0 }, ...prev])} />}

        {tracks.length === 0 ? (
          <div style={{ fontSize: 12.5, color: 'var(--text-muted)', textAlign: 'center', padding: '30px 0' }}>
            No tracks yet — upload your first one above.
          </div>
        ) : (
          tracks.map((track) => (
            <div key={track.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 4px', borderBottom: '1px solid var(--border)' }}>
              <div style={{ width: 42, height: 42, borderRadius: 8, overflow: 'hidden', flexShrink: 0, background: 'var(--bg-surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {track.cover_url ? <img src={track.cover_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <IconMusic size={16} style={{ color: 'var(--text-muted)' }} />}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{track.title}</div>
                <div style={{ display: 'flex', gap: 12, marginTop: 3 }}>
                  <StatPill icon={IconPlay} value={track.play_count} label="plays" />
                  <StatPill icon={IconHeart} value={track.like_count} label="likes" />
                  <StatPill icon={IconDownload} value={track.download_count} label="downloads" />
                </div>
              </div>
              <button onClick={() => handleToggleStatus(track)} aria-label={track.status === 'published' ? 'Unpublish' : 'Publish'} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: track.status === 'published' ? '#a78bfa' : 'var(--text-muted)', padding: 6 }}>
                {track.status === 'published' ? <IconEye size={16} /> : <IconEyeOff size={16} />}
              </button>
              <button onClick={() => handleDelete(track)} aria-label="Delete" style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 6 }}>
                <IconTrash size={15} />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
