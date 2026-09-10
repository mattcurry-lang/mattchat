import React, { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { useMusicPlayer } from '../../context/MusicPlayerContext'
import { PlaylistService } from '../../../lib/music/PlaylistService'
import PlaylistDetailOverlay from './PlaylistDetailOverlay'
import { IconListMusic, IconPlus, IconMusic } from '../../Icons'
import { useMusicColors } from '../../../hooks/useMusicColors'

export default function PlaylistsSection() {
  const { userId } = useMusicPlayer()
  const colors = useMusicColors()
  const [playlists, setPlaylists] = useState([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [openPlaylistId, setOpenPlaylistId] = useState(null)

  const load = useCallback(async () => {
    if (!userId) { setLoading(false); return }
    try { setPlaylists(await PlaylistService.listPlaylists(userId)) }
    catch { /* non-fatal */ }
    finally { setLoading(false) }
  }, [userId])

  useEffect(() => { load() }, [load])

  if (!userId) return null

  const handleCreate = async () => {
    const name = newName.trim()
    if (!name) return
    try {
      const playlist = await PlaylistService.createPlaylist(userId, name)
      setPlaylists((prev) => [playlist, ...prev])
      setNewName(''); setCreating(false); setOpenPlaylistId(playlist.id)
    } catch { /* leave input open to retry */ }
  }

  return (
    <div style={{ marginBottom: 26 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ fontSize: 14.5, fontWeight: 800, color: colors.textPrimary, letterSpacing: -0.2 }}>My Playlists</div>
        <button onClick={() => setCreating((c) => !c)}
          style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11.5, fontWeight: 700, color: '#a78bfa', background: 'transparent', border: 'none', cursor: 'pointer' }}>
          <IconPlus size={13} /> New
        </button>
      </div>

      {creating && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <input autoFocus value={newName} onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()} placeholder="Playlist name"
            style={{ flex: 1, fontSize: 13, padding: '8px 10px', borderRadius: 8, border: `1px solid ${colors.border}`, background: colors.surface2, color: colors.textPrimary }} />
          <button onClick={handleCreate}
            style={{ fontSize: 12.5, fontWeight: 700, color: '#fff', background: 'linear-gradient(135deg,#a78bfa,#6c63ff)', border: 'none', borderRadius: 8, padding: '0 14px', cursor: 'pointer' }}>
            Create
          </button>
        </div>
      )}

      {loading ? (
        <div style={{ fontSize: 12.5, color: colors.textMuted }}>Loading playlists…</div>
      ) : playlists.length === 0 ? (
        <div style={{ fontSize: 12.5, color: colors.textMuted }}>
          No playlists yet — create one, or add a song to a new playlist from its menu.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 14 }}>
          {playlists.map((p, i) => (
            <motion.button
              key={p.id}
              onClick={() => setOpenPlaylistId(p.id)}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i, 8) * 0.03, duration: 0.25 }}
              whileHover={{ y: -3 }}
              whileTap={{ scale: 0.97 }}
              style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, textAlign: 'left' }}
            >
              <div style={{
                width: '100%', aspectRatio: '1 / 1', borderRadius: 12, overflow: 'hidden',
                background: p.artwork_url ? colors.surface2 : 'linear-gradient(135deg, rgba(167,139,250,0.35), rgba(108,99,255,0.2))',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 6px 18px rgba(0,0,0,0.3)',
              }}>
                {p.artwork_url ? (
                  <img src={p.artwork_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <IconListMusic size={30} style={{ color: 'rgba(255,255,255,0.85)' }} />
                )}
              </div>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: colors.textPrimary, marginTop: 8, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {p.name}
              </div>
            </motion.button>
          ))}
        </div>
      )}

      {openPlaylistId && (
        <PlaylistDetailOverlay
          playlistId={openPlaylistId}
          initialName={playlists.find((p) => p.id === openPlaylistId)?.name || ''}
          onClose={() => setOpenPlaylistId(null)}
          onDeleted={(id) => { setPlaylists((prev) => prev.filter((p) => p.id !== id)); setOpenPlaylistId(null) }}
          onRenamed={(id, name) => setPlaylists((prev) => prev.map((p) => (p.id === id ? { ...p, name } : p)))}
        />
      )}
    </div>
  )
}
