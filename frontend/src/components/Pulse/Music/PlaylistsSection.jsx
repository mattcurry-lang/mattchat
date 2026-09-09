import React, { useState, useEffect, useCallback } from 'react'
import { useMusicPlayer } from '../../context/MusicPlayerContext'
import { PlaylistService } from '../../../lib/music/PlaylistService'
import PlaylistDetailOverlay from './PlaylistDetailOverlay'
import { IconListMusic, IconPlus, IconMusic } from '../../Icons'

/**
 * components/Pulse/Music/PlaylistsSection.jsx
 *
 * "My Playlists" (§12). Renders nothing if the user isn't signed in
 * (userId is null) — playlists require an account, unlike the
 * localStorage-backed likes/recently-played.
 */
export default function PlaylistsSection() {
  const { userId } = useMusicPlayer()
  const [playlists, setPlaylists] = useState([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [openPlaylistId, setOpenPlaylistId] = useState(null)

  const load = useCallback(async () => {
    if (!userId) { setLoading(false); return }
    try {
      const rows = await PlaylistService.listPlaylists(userId)
      setPlaylists(rows)
    } catch {
      // non-fatal — Pulse Music still works without playlists loaded
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => { load() }, [load])

  if (!userId) return null

  const handleCreate = async () => {
    const name = newName.trim()
    if (!name) return
    try {
      const playlist = await PlaylistService.createPlaylist(userId, name)
      setPlaylists((prev) => [playlist, ...prev])
      setNewName('')
      setCreating(false)
      setOpenPlaylistId(playlist.id)
    } catch {
      // leave the input open so the user can retry
    }
  }

  return (
    <div style={{ marginBottom: 22 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-primary)' }}>My Playlists</div>
        <button
          onClick={() => setCreating((c) => !c)}
          style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11.5, fontWeight: 700, color: '#a78bfa', background: 'transparent', border: 'none', cursor: 'pointer' }}
        >
          <IconPlus size={13} /> New
        </button>
      </div>

      {creating && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
          <input
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            placeholder="Playlist name"
            style={{
              flex: 1, fontSize: 13, padding: '8px 10px', borderRadius: 8,
              border: '1px solid var(--border)', background: 'var(--bg-surface-2)', color: 'var(--text-primary)',
            }}
          />
          <button
            onClick={handleCreate}
            style={{ fontSize: 12.5, fontWeight: 700, color: '#fff', background: 'linear-gradient(135deg,#a78bfa,#6c63ff)', border: 'none', borderRadius: 8, padding: '0 14px', cursor: 'pointer' }}
          >
            Create
          </button>
        </div>
      )}

      {loading ? (
        <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>Loading playlists…</div>
      ) : playlists.length === 0 ? (
        <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>
          No playlists yet — create one, or add a song to a new playlist from its menu.
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 4 }}>
          {playlists.map((p) => (
            <button
              key={p.id}
              onClick={() => setOpenPlaylistId(p.id)}
              style={{ width: 112, flexShrink: 0, background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, textAlign: 'left' }}
            >
              <div style={{
                width: 112, height: 112, borderRadius: 12, overflow: 'hidden', background: 'var(--bg-surface-2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {p.artwork_url ? (
                  <img src={p.artwork_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <IconListMusic size={26} style={{ color: 'var(--text-muted)' }} />
                )}
              </div>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', marginTop: 6, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {p.name}
              </div>
            </button>
          ))}
        </div>
      )}

      {openPlaylistId && (
        <PlaylistDetailOverlay
          playlistId={openPlaylistId}
          initialName={playlists.find((p) => p.id === openPlaylistId)?.name || ''}
          onClose={() => setOpenPlaylistId(null)}
          onDeleted={(id) => {
            setPlaylists((prev) => prev.filter((p) => p.id !== id))
            setOpenPlaylistId(null)
          }}
          onRenamed={(id, name) => {
            setPlaylists((prev) => prev.map((p) => (p.id === id ? { ...p, name } : p)))
          }}
        />
      )}
    </div>
  )
}
