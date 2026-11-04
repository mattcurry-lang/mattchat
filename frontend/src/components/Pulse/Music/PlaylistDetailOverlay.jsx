import React, { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { useMusicPlayer } from '../../context/MusicPlayerContext'
import { PlaylistService } from '../../../lib/music/PlaylistService'
import { useDominantColor, rgba } from '../../../lib/music/extractColor'
import { IconX, IconMusic, IconPlay, IconTrash, IconPencil, IconCheck, IconShuffle, IconHeart } from '../../Icons'

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
      style={{ position: 'fixed', inset: 0, zIndex: 650, background: '#0b0b13', overflowY: 'auto', color: '#fff' }}
    >
      {/* Immersive Hero Header (Spotify/Boomplay Hybrid) */}
      <div style={{
        position: 'relative', padding: '32px 24px 28px',
        background: `linear-gradient(180deg, ${rgba(dominant, 0.85)} 0%, ${rgba(dominant, 0.35)} 65%, #0b0b13 100%)`,
        transition: 'background 0.6s ease',
      }}>
        <div style={{ maxWidth: 760, margin: '0 auto' }}>
          
          {/* Top Bar Controls */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.7)', background: 'rgba(0,0,0,0.25)', padding: '4px 12px', borderRadius: 20 }}>
              <IconMusic size={13} /> Curated Playlist
            </div>
            <button onClick={onClose} aria-label="Close"
              style={{ width: 36, height: 36, borderRadius: '50%', border: 'none', cursor: 'pointer', background: 'rgba(0,0,0,0.3)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.2s' }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(0,0,0,0.5)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(0,0,0,0.3)'}
            >
              <IconX size={18} />
            </button>
          </div>

          {/* Hero Content Grid (Artwork + Info) */}
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 24, marginBottom: 28 }}>
            <div style={{ width: 140, height: 140, borderRadius: 12, overflow: 'hidden', background: 'rgba(255,255,255,0.1)', boxShadow: '0 16px 32px rgba(0,0,0,0.5)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {heroArtwork ? (
                <img src={heroArtwork} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <IconMusic size={40} style={{ color: 'rgba(255,255,255,0.4)' }} />
              )}
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                {renaming ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
                    <input autoFocus value={name} onChange={(e) => setName(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleRename()}
                      style={{ fontSize: 24, fontWeight: 900, flex: 1, padding: '6px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.4)', background: 'rgba(0,0,0,0.4)', color: '#fff', outline: 'none' }} />
                    <button onClick={handleRename} aria-label="Save name" style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '50%', width: 32, height: 32, cursor: 'pointer', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <IconCheck size={16} />
                    </button>
                  </div>
                ) : (
                  <button onClick={() => setRenaming(true)}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left', padding: 0 }}>
                    <h1 style={{ fontSize: 32, fontWeight: 900, color: '#fff', margin: 0, letterSpacing: -0.8, textShadow: '0 2px 8px rgba(0,0,0,0.4)' }}>{name}</h1>
                    <IconPencil size={15} style={{ color: 'rgba(255,255,255,0.6)' }} />
                  </button>
                )}
              </div>

              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)', fontWeight: 500 }}>
                {tracks.length} {tracks.length === 1 ? 'song' : 'songs'}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          {tracks.length > 0 && (
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <button onClick={() => handlePlayAll(false)}
                style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 800, color: '#0b0b13', background: '#1ed760', border: 'none', borderRadius: 999, padding: '12px 28px', cursor: 'pointer', boxShadow: '0 4px 14px rgba(30,215,96,0.4)', transition: 'transform 0.1s' }}
                onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.97)'}
                onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1)'}
              >
                <IconPlay size={16} /> Play All
              </button>
              <button onClick={() => handlePlayAll(true)}
                style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 700, color: '#fff', background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 999, padding: '12px 24px', cursor: 'pointer', transition: 'background 0.2s' }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.2)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.12)'}
              >
                <IconShuffle size={16} /> Shuffle
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Track List Section */}
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '24px 24px 120px' }}>
        {loading ? (
          <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)', padding: '20px 0' }}>Loading tracks...</div>
        ) : tracks.length === 0 ? (
          <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)', padding: '40px 0', textAlign: 'center' }}>
            No songs yet — add tracks from search or from the ··· menu on any song.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {tracks.map((track, i) => (
              <motion.div
                key={track._playlistTrackRowId}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i, 12) * 0.02, duration: 0.2 }}
                style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '10px 12px', borderRadius: 8, transition: 'background 0.2s' }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                <span style={{ width: 20, textAlign: 'center', fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.4)', flexShrink: 0 }}>{i + 1}</span>
                
                <button onClick={() => playTrack(track, tracks)}
                  style={{ display: 'flex', alignItems: 'center', gap: 14, flex: 1, minWidth: 0, background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, textAlign: 'left' }}>
                  <div style={{ width: 44, height: 44, borderRadius: 8, overflow: 'hidden', flexShrink: '0', background: 'rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {track.artwork ? <img src={track.artwork} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <IconMusic size={18} style={{ color: 'rgba(255,255,255,0.4)' }} />}
                  </div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginBottom: 3 }}>{track.title}</div>
                    <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.6)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{track.artist}</div>
                  </div>
                </button>

                <button onClick={() => handleRemove(track)} aria-label="Remove from playlist"
                  style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.4)', padding: 8, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'color 0.2s' }}
                  onMouseEnter={(e) => e.currentTarget.style.color = '#f87171'}
                  onMouseLeave={(e) => e.currentTarget.style.color = 'rgba(255,255,255,0.4)'}
                >
                  <IconTrash size={16} />
                </button>
              </motion.div>
            ))}
          </div>
        )}

        {/* Delete Playlist Footer Area */}
        <div style={{ marginTop: 40, paddingTop: 20, borderTop: '1px solid rgba(255,255,255,0.1)' }}>
          {confirmDelete ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, background: 'rgba(248,113,113,0.1)', padding: '12px 16px', borderRadius: 8, border: '1px solid rgba(248,113,113,0.3)' }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#f87171' }}>Permanently delete this playlist?</span>
              <button onClick={handleDelete} style={{ fontSize: 13, fontWeight: 700, color: '#fff', background: '#f87171', border: 'none', padding: '6px 14px', borderRadius: 6, cursor: 'pointer' }}>Delete</button>
              <button onClick={() => setConfirmDelete(false)} style={{ fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.7)', background: 'transparent', border: 'none', cursor: 'pointer' }}>Cancel</button>
            </div>
          ) : (
            <button onClick={() => setConfirmDelete(true)} style={{ fontSize: 13, fontWeight: 700, color: '#f87171', background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px 0', opacity: 0.8, transition: 'opacity 0.2s' }}
              onMouseEnter={(e) => e.currentTarget.style.opacity = 1}
              onMouseLeave={(e) => e.currentTarget.style.opacity = 0.8}
            >
              Delete playlist
            </button>
          )}
        </div>
      </div>
    </motion.div>
  )
}
