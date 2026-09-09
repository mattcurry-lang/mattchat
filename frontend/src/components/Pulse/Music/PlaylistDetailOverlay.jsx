import React, { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { useMusicPlayer } from '../../context/MusicPlayerContext'
import { PlaylistService } from '../../../lib/music/PlaylistService'
import { useDominantColor, rgba } from '../../../lib/music/extractColor'
import { IconX, IconMusic, IconPlay, IconTrash, IconPencil, IconCheck, IconShuffle } from '../../Icons'

export default function PlaylistDetailOverlay({ playlistId, initialName, onClose, onDeleted, onRenamed }) {
  const { playTrack, toggleShuffle, shuffle } = useMusicPlayer()
  const [tracks, setTracks] = useState([])
  const [loading, setLoading] = useState(true)
  const [renaming, setRenaming] = useState(false)
  const [name, setName] = useState(initialName)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try { setTracks(await PlaylistService.getPlaylistTracks(playlistId)) }
    catch { setTracks([]) }
    finally { setLoading(false) }
  }, [playlistId])

  useEffect(() => { load() }, [load])

  const heroArtwork = tracks[0]?.artwork || null
  const dominant = useDominantColor(heroArtwork)

  const handleRemove = async (track) => {
    setTracks((prev) => prev.filter((t) => t._playlistTrackRowId !== track._playlistTrackRowId))
    try { await PlaylistService.removeTrack(track._playlistTrackRowId) } catch { load() }
  }

  const handleRename = async () => {
    const trimmed = name.trim()
    if (!trimmed || trimmed === initialName) { setRenaming(false); return }
    try { await PlaylistService.renamePlaylist(playlistId, trimmed); onRenamed(playlistId, trimmed) }
    catch { setName(initialName) }
    setRenaming(false)
  }

  const handleDelete = async () => {
    try { await PlaylistService.deletePlaylist(playlistId); onDeleted(playlistId) }
    catch { setConfirmDelete(false) }
  }

  const handlePlayAll = (fromShuffled) => {
    if (tracks.length === 0) return
    if (fromShuffled && !shuffle) toggleShuffle()
    playTrack(tracks[0], tracks)
  }

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}
      style={{ position: 'fixed', inset: 0, zIndex: 650, background: '#0b0b13', overflowY: 'auto' }}
    >
      {/* hero — color pulled from the playlist's first track, same
          "environmental" treatment as FullPlayer, so a playlist page
          doesn't read as a plain settings list */}
      <div style={{
        position: 'relative', padding: '16px 16px 30px',
        background: `linear-gradient(180deg, ${rgba(dominant, 0.75)} 0%, ${rgba(dominant, 0.25)} 55%, #0b0b13 100%)`,
        transition: 'background 0.6s ease',
      }}>
        <div style={{ maxWidth: 640, margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
            {renaming ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
                <input autoFocus value={name} onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleRename()}
                  style={{ fontSize: 16, fontWeight: 800, flex: 1, padding: '6px 10px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.25)', background: 'rgba(255,255,255,0.1)', color: '#fff' }} />
                <button onClick={handleRename} aria-label="Save name" style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#fff' }}>
                  <IconCheck size={18} />
                </button>
              </div>
            ) : (
              <button onClick={() => setRenaming(true)}
                style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
                <h2 style={{ fontSize: 22, fontWeight: 900, color: '#fff', margin: 0, letterSpacing: -0.4 }}>{name}</h2>
                <IconPencil size={13} style={{ color: 'rgba(255,255,255,0.5)' }} />
              </button>
            )}
            <button onClick={onClose}
              style={{ width: 32, height: 32, borderRadius: '50%', border: 'none', cursor: 'pointer', background: 'rgba(255,255,255,0.12)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginLeft: 8 }}>
              <IconX size={15} />
            </button>
          </div>

          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', marginBottom: 18 }}>
            {tracks.length} {tracks.length === 1 ? 'song' : 'songs'}
          </div>

          {tracks.length > 0 && (
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => handlePlayAll(false)}
                style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 800, color: '#0f0f1a', background: '#fff', border: 'none', borderRadius: 999, padding: '10px 20px', cursor: 'pointer' }}>
                <IconPlay size={13} /> Play
              </button>
              <button onClick={() => handlePlayAll(true)}
                style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, color: '#fff', background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 999, padding: '10px 20px', cursor: 'pointer' }}>
                <IconShuffle size={13} /> Shuffle
              </button>
            </div>
          )}
        </div>
      </div>

      <div style={{ maxWidth: 640, margin: '0 auto', padding: '16px 16px 100px' }}>
        {loading ? (
          <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>Loading…</div>
        ) : tracks.length === 0 ? (
          <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>
            No songs yet — add tracks from search or from the ··· menu on any song.
          </div>
        ) : (
          tracks.map((track, i) => (
            <motion.div
              key={track._playlistTrackRowId}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i, 12) * 0.02, duration: 0.2 }}
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 4px' }}
            >
              <span style={{ width: 18, textAlign: 'center', fontSize: 12, color: 'var(--text-muted)', flexShrink: 0 }}>{i + 1}</span>
              <button onClick={() => playTrack(track, tracks)}
                style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0, background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, textAlign: 'left' }}>
                <div style={{ width: 40, height: 40, borderRadius: 8, overflow: 'hidden', flexShrink: 0, background: 'var(--bg-surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {track.artwork ? <img src={track.artwork} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <IconMusic size={16} style={{ color: 'var(--text-muted)' }} />}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{track.title}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{track.artist}</div>
                </div>
              </button>
              <button onClick={() => handleRemove(track)} aria-label="Remove from playlist"
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 6, flexShrink: 0 }}>
                <IconTrash size={15} />
              </button>
            </motion.div>
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
    </motion.div>
  )
}
