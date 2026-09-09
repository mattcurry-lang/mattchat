import React, { useState, useEffect, useCallback } from 'react'
import { useMusicPlayer } from '../../context/MusicPlayerContext'
import { PlaylistService } from '../../../lib/music/PlaylistService'
import { IconX, IconMusic, IconPlay, IconTrash, IconPencil, IconCheck, IconShuffle } from '../../Icons'

/**
 * components/Pulse/Music/PlaylistDetailOverlay.jsx
 *
 * Opened from PlaylistsSection. Handles play-all, shuffle-all,
 * per-track removal, rename, and delete (§12).
 */
export default function PlaylistDetailOverlay({ playlistId, initialName, onClose, onDeleted, onRenamed }) {
  const { playTrack, toggleShuffle, shuffle } = useMusicPlayer()
  const [tracks, setTracks] = useState([])
  const [loading, setLoading] = useState(true)
  const [renaming, setRenaming] = useState(false)
  const [name, setName] = useState(initialName)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const rows = await PlaylistService.getPlaylistTracks(playlistId)
      setTracks(rows)
    } catch {
      setTracks([])
    } finally {
      setLoading(false)
    }
  }, [playlistId])

  useEffect(() => { load() }, [load])

  const handleRemove = async (track) => {
    setTracks((prev) => prev.filter((t) => t._playlistTrackRowId !== track._playlistTrackRowId))
    try {
      await PlaylistService.removeTrack(track._playlistTrackRowId)
    } catch {
      load() // out of sync with the server — reload to recover
    }
  }

  const handleRename = async () => {
    const trimmed = name.trim()
    if (!trimmed || trimmed === initialName) { setRenaming(false); return }
    try {
      await PlaylistService.renamePlaylist(playlistId, trimmed)
      onRenamed(playlistId, trimmed)
    } catch {
      setName(initialName)
    }
    setRenaming(false)
  }

  const handleDelete = async () => {
    try {
      await PlaylistService.deletePlaylist(playlistId)
      onDeleted(playlistId)
    } catch {
      setConfirmDelete(false)
    }
  }

  const handlePlayAll = (fromShuffled) => {
    if (tracks.length === 0) return
    if (fromShuffled && !shuffle) toggleShuffle()
    playTrack(tracks[0], tracks)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 650, background: 'var(--bg-surface-1, #0f0f1a)', overflowY: 'auto' }}>
      <div style={{ maxWidth: 640, margin: '0 auto', padding: 16, paddingBottom: 100 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          {renaming ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleRename()}
                style={{ fontSize: 16, fontWeight: 800, flex: 1, padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-surface-2)', color: 'var(--text-primary)' }}
              />
              <button onClick={handleRename} aria-label="Save name" style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#a78bfa' }}>
                <IconCheck size={18} />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setRenaming(true)}
              style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left' }}
            >
              <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>{name}</h2>
              <IconPencil size={13} style={{ color: 'var(--text-muted)' }} />
            </button>
          )}
          <button
            onClick={onClose}
            style={{ width: 30, height: 30, borderRadius: '50%', border: 'none', cursor: 'pointer', background: 'var(--bg-surface-2)', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginLeft: 8 }}
          >
            <IconX size={15} />
          </button>
        </div>

        {tracks.length > 0 && (
          <div style={{ display: 'flex', gap: 10, marginBottom: 18 }}>
            <button
              onClick={() => handlePlayAll(false)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 700, color: '#fff', background: 'linear-gradient(135deg,#a78bfa,#6c63ff)', border: 'none', borderRadius: 10, padding: '9px 16px', cursor: 'pointer' }}
            >
              <IconPlay size={13} /> Play
            </button>
            <button
              onClick={() => handlePlayAll(true)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 700, color: 'var(--text-primary)', background: 'var(--bg-surface-2)', border: '1px solid var(--border)', borderRadius: 10, padding: '9px 16px', cursor: 'pointer' }}
            >
              <IconShuffle size={13} /> Shuffle
            </button>
          </div>
        )}

        {loading ? (
          <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>Loading…</div>
        ) : tracks.length === 0 ? (
          <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>
            No songs yet — add tracks from search or from the ··· menu on any song.
          </div>
        ) : (
          tracks.map((track) => (
            <div key={track._playlistTrackRowId} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 4px' }}>
              <button
                onClick={() => playTrack(track, tracks)}
                style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0, background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, textAlign: 'left' }}
              >
                <div style={{ width: 40, height: 40, borderRadius: 8, overflow: 'hidden', flexShrink: 0, background: 'var(--bg-surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {track.artwork ? (
                    <img src={track.artwork} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <IconMusic size={16} style={{ color: 'var(--text-muted)' }} />
                  )}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{track.title}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{track.artist}</div>
                </div>
              </button>
              <button
                onClick={() => handleRemove(track)}
                aria-label="Remove from playlist"
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 6, flexShrink: 0 }}
              >
                <IconTrash size={15} />
              </button>
            </div>
          ))
        )}

        <div style={{ marginTop: 28, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
          {confirmDelete ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>Delete this playlist?</span>
              <button onClick={handleDelete} style={{ fontSize: 12, fontWeight: 700, color: '#f87171', background: 'transparent', border: 'none', cursor: 'pointer' }}>Delete</button>
              <button onClick={() => setConfirmDelete(false)} style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', background: 'transparent', border: 'none', cursor: 'pointer' }}>Cancel</button>
            </div>
          ) : (
            <button onClick={() => setConfirmDelete(true)} style={{ fontSize: 12, fontWeight: 700, color: '#f87171', background: 'transparent', border: 'none', cursor: 'pointer' }}>
              Delete playlist
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
