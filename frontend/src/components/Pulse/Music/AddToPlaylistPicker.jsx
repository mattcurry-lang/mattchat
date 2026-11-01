import React, { useState, useEffect } from 'react'
import { useMusicPlayer } from '../../context/MusicPlayerContext'
import { PlaylistService } from '../../../lib/music/PlaylistService'
import { IconPlus, IconListMusic, IconCheck } from '../../Icons'

/**
 * components/Pulse/Music/AddToPlaylistPicker.jsx
 *
 * Rendered inside TrackRail's "···" menu. Lists the user's playlists
 * with a one-tap add, plus an inline "New playlist" option that
 * creates + adds in one step.
 */
export default function AddToPlaylistPicker({ track, onDone }) {
  const { userId } = useMusicPlayer()
  const [playlists, setPlaylists] = useState([])
  const [loading, setLoading] = useState(true)
  const [addedIds, setAddedIds] = useState(new Set())
  const [creatingName, setCreatingName] = useState('')

  useEffect(() => {
    if (!userId) { setLoading(false); return }
    PlaylistService.listPlaylists(userId)
      .then(setPlaylists)
      .catch(() => setPlaylists([]))
      .finally(() => setLoading(false))
  }, [userId])

  if (!userId) {
    return <div style={{ padding: '9px 12px', fontSize: 12, color: 'var(--text-muted)' }}>Sign in to use playlists</div>
  }

  const handleAdd = async (playlistId) => {
    setAddedIds((prev) => new Set(prev).add(playlistId))
    try {
      await PlaylistService.addTrack(playlistId, track)
    } catch {
      setAddedIds((prev) => { const n = new Set(prev); n.delete(playlistId); return n })
    }
  }

  const handleCreateAndAdd = async () => {
    const name = creatingName.trim()
    if (!name) return
    try {
      const playlist = await PlaylistService.createPlaylist(userId, name)
      await PlaylistService.addTrack(playlist.id, track)
      setPlaylists((prev) => [playlist, ...prev])
      setAddedIds((prev) => new Set(prev).add(playlist.id))
      setCreatingName('')
      onDone && onDone()
    } catch {
      // leave the input as-is so the user can retry
    }
  }

  return (
    <div style={{ width: 200 }}>
      <div style={{ maxHeight: 160, overflowY: 'auto' }}>
        {loading ? (
          <div style={{ padding: '9px 12px', fontSize: 12, color: 'var(--text-muted)' }}>Loading…</div>
        ) : playlists.length === 0 ? (
          <div style={{ padding: '9px 12px', fontSize: 12, color: 'var(--text-muted)' }}>No playlists yet</div>
        ) : (
          playlists.map((p) => (
            <button
              key={p.id}
              onClick={() => handleAdd(p.id)}
              disabled={addedIds.has(p.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '9px 12px',
                background: 'transparent', border: 'none', cursor: addedIds.has(p.id) ? 'default' : 'pointer',
                textAlign: 'left', fontSize: 12.5, fontWeight: 600,
                color: addedIds.has(p.id) ? '#a78bfa' : 'var(--text-primary)',
              }}
            >
              {addedIds.has(p.id) ? <IconCheck size={14} /> : <IconListMusic size={14} style={{ color: 'var(--text-muted)' }} />}
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
            </button>
          ))
        )}
      </div>
      <div style={{ borderTop: '1px solid var(--border)', padding: 8, display: 'flex', gap: 6 }}>
        <input
          value={creatingName}
          onChange={(e) => setCreatingName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleCreateAndAdd()}
          placeholder="New playlist…"
          style={{ flex: 1, fontSize: 12, padding: '6px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-surface-2)', color: 'var(--text-primary)' }}
        />
        <button
          onClick={handleCreateAndAdd}
          aria-label="Create playlist and add"
          style={{ background: '#a78bfa', border: 'none', borderRadius: 6, width: 26, color: '#0f0f1a', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <IconPlus size={13} />
        </button>
      </div>
    </div>
  )
}
