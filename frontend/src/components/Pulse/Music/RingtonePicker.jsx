import React, { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { RingtoneService } from '../../../lib/music/RingtoneService'
import { MusicService } from '../../../lib/music/MusicService'
import { useMusicColors } from '../../../hooks/useMusicColors'
import { IconX, IconMusic, IconSearch, IconPlay, IconPause, IconCheck } from '../../Icons'

const DEBOUNCE_MS = 320

/**
 * components/Pulse/Music/RingtonePicker.jsx
 *
 * Browse/search Audius + Mattchat-artist tracks and set one as the
 * user's personal Mattchat ringtone. Deliberately excludes YouTube
 * results (see RingtoneService.js for why) by requesting each
 * provider's search directly rather than the merged MusicService
 * search, which would include YouTube.
 */
export default function RingtonePicker({ userId, currentRingtone, onSaved, onClose }) {
  const colors = useMusicColors()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [previewingId, setPreviewingId] = useState(null)
  const [saving, setSaving] = useState(null)
  const [error, setError] = useState(null)
  const debounceRef = useRef(null)

  useEffect(() => {
    clearTimeout(debounceRef.current)
    if (!query.trim()) { setResults([]); setSearching(false); return }
    setSearching(true)
    debounceRef.current = setTimeout(async () => {
      try {
        // Ringtone-safe providers only — no YouTube in this list.
        const [audiusRes, mattchatRes] = await Promise.all([
          MusicService.search(query, { limit: 8, provider: 'audius' }),
          MusicService.search(query, { limit: 8, provider: 'mattchat' }),
        ])
        setResults([...(mattchatRes.tracks || []), ...(audiusRes.tracks || [])])
      } catch {
        setResults([])
      } finally {
        setSearching(false)
      }
    }, DEBOUNCE_MS)
    return () => clearTimeout(debounceRef.current)
  }, [query])

  useEffect(() => () => RingtoneService.stopRingtone(), [])

  const handlePreview = (track) => {
    if (previewingId === track.id) {
      RingtoneService.stopRingtone()
      setPreviewingId(null)
      return
    }
    setPreviewingId(track.id)
    RingtoneService.previewTrack(track, 8000)
    setTimeout(() => setPreviewingId((p) => (p === track.id ? null : p)), 8000)
  }

  const handleSetRingtone = async (track) => {
    setSaving(track.id)
    setError(null)
    try {
      await RingtoneService.setRingtone(userId, track)
      RingtoneService.stopRingtone()
      onSaved(track)
    } catch (e) {
      setError(e.message || 'Could not set ringtone')
    } finally {
      setSaving(null)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}
      style={{ position: 'fixed', inset: 0, zIndex: 900, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
      onClick={onClose}
    >
      <motion.div
        onClick={(e) => e.stopPropagation()}
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ type: 'spring', stiffness: 380, damping: 34 }}
        style={{
          width: '100%', maxWidth: 480, maxHeight: '80vh', display: 'flex', flexDirection: 'column',
          background: colors.surface1, borderTopLeftRadius: 20, borderTopRightRadius: 20,
          paddingBottom: 'env(safe-area-inset-bottom, 0px)', boxShadow: '0 -12px 40px rgba(0,0,0,0.35)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 16px 8px' }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: colors.textPrimary }}>Choose your ringtone</div>
          <button onClick={onClose} aria-label="Close" style={{ width: 28, height: 28, borderRadius: '50%', border: 'none', background: colors.surface2, color: colors.textSecondary, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <IconX size={14} />
          </button>
        </div>

        {currentRingtone && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '0 16px 12px', padding: '8px 10px', background: 'rgba(167,139,250,0.10)', border: '1px solid rgba(167,139,250,0.22)', borderRadius: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 7, overflow: 'hidden', flexShrink: 0, background: colors.surface2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {currentRingtone.artwork ? <img src={currentRingtone.artwork} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <IconMusic size={13} style={{ color: colors.textMuted }} />}
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 11, color: colors.textMuted }}>Current ringtone</div>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: colors.textPrimary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{currentRingtone.title}</div>
            </div>
          </div>
        )}

        <div style={{ padding: '0 16px 10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: colors.surface2, border: `1px solid ${colors.border}`, borderRadius: 10, padding: '9px 12px' }}>
            <IconSearch size={15} style={{ color: colors.textMuted, flexShrink: 0 }} />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search songs to use as your ringtone…"
              style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: colors.textPrimary, fontSize: 13.5, fontFamily: 'inherit' }}
            />
          </div>
          <div style={{ fontSize: 11, color: colors.textMuted, marginTop: 6 }}>
            Mattchat artist and Audius tracks only \u2014 tap a song to preview 8 seconds.
          </div>
        </div>

        {error && <div style={{ fontSize: 12, color: '#f87171', padding: '0 16px 8px' }}>{error}</div>}

        <div style={{ overflowY: 'auto', padding: '0 8px 16px', flex: 1 }}>
          {searching && <div style={{ fontSize: 12.5, color: colors.textMuted, padding: '10px 8px' }}>Searching\u2026</div>}
          {!searching && query.trim() && results.length === 0 && (
            <div style={{ fontSize: 12.5, color: colors.textMuted, padding: '10px 8px' }}>No results.</div>
          )}

          {results.map((track) => {
            const isPreviewing = previewingId === track.id
            const isSaving = saving === track.id
            return (
              <div key={track.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 8px' }}>
                <button
                  onClick={() => handlePreview(track)}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0, background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left', padding: 0, fontFamily: 'inherit' }}
                >
                  <div style={{ width: 38, height: 38, borderRadius: 8, overflow: 'hidden', flexShrink: 0, background: colors.surface2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {track.artwork ? <img src={track.artwork} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <IconMusic size={14} style={{ color: colors.textMuted }} />}
                  </div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 700, color: colors.textPrimary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{track.title}</div>
                    <div style={{ fontSize: 11, color: colors.textMuted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{track.artist}</div>
                  </div>
                  <div style={{ width: 28, height: 28, borderRadius: '50%', flexShrink: 0, background: isPreviewing ? 'linear-gradient(135deg,#a78bfa,#6c63ff)' : colors.surface2, color: isPreviewing ? '#fff' : colors.textSecondary, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {isPreviewing ? <IconPause size={12} /> : <IconPlay size={12} />}
                  </div>
                </button>
                <button
                  onClick={() => handleSetRingtone(track)}
                  disabled={isSaving}
                  style={{
                    fontSize: 11.5, fontWeight: 700, padding: '7px 12px', borderRadius: 999, border: 'none', cursor: 'pointer', flexShrink: 0,
                    color: '#fff', background: 'linear-gradient(135deg,#a78bfa,#6c63ff)', opacity: isSaving ? 0.6 : 1,
                    display: 'flex', alignItems: 'center', gap: 4,
                  }}
                >
                  {isSaving ? 'Saving\u2026' : (<><IconCheck size={11} /> Set</>)}
                </button>
              </div>
            )
          })}
        </div>
      </motion.div>
    </motion.div>
  )
}
