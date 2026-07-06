import React, { useState, useEffect, useRef, useCallback } from 'react'
import { getStatusViewers, deleteStatus, getStatusMediaUrl } from '../lib/supabase'
import { IconX, IconTrash } from './Icons'

const DURATION_MS = 5000

export default function StatusViewer({ group, isMine, onClose, onViewed, onDeleted, onNextGroup, onPrevGroup }) {
  const [index, setIndex] = useState(0)
  const [progress, setProgress] = useState(0)
  const [paused, setPaused] = useState(false)
  const [viewers, setViewers] = useState([])
  const rafRef = useRef(null)
  const startRef = useRef(null)

  const statuses = group.statuses
  const current = statuses[index]

  const advance = useCallback(() => {
    if (index < statuses.length - 1) setIndex(i => i + 1)
    else if (onNextGroup) onNextGroup()
    else onClose()
  }, [index, statuses.length, onNextGroup, onClose])

  const goBack = useCallback(() => {
    if (index > 0) setIndex(i => i - 1)
    else if (onPrevGroup) onPrevGroup()
  }, [index, onPrevGroup])

  useEffect(() => {
    setProgress(0)
    startRef.current = null
    onViewed?.(current.id)
    if (isMine) getStatusViewers(current.id).then(setViewers)
  }, [current, isMine, onViewed])

  useEffect(() => {
    if (paused) { cancelAnimationFrame(rafRef.current); return }
    const tick = (ts) => {
      if (!startRef.current) startRef.current = ts - progress * DURATION_MS
      const elapsed = ts - startRef.current
      const pct = Math.min(1, elapsed / DURATION_MS)
      setProgress(pct)
      if (pct >= 1) { advance(); return }
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [current, paused])

  const handleDelete = async () => {
    if (!window.confirm('Delete this status?')) return
    await deleteStatus(current.id)
    onDeleted?.(current.id)
    if (statuses.length <= 1) onClose()
    else advance()
  }

  return (
    <div
      className="status-viewer-overlay"
      onMouseDown={() => setPaused(true)}
      onMouseUp={() => setPaused(false)}
      onTouchStart={() => setPaused(true)}
      onTouchEnd={() => setPaused(false)}
    >
      <div className="status-viewer-bars">
        {statuses.map((s, i) => (
          <div key={s.id} className="status-viewer-bar">
            <div className="status-viewer-bar-fill" style={{ width: `${i < index ? 100 : i === index ? progress * 100 : 0}%` }} />
          </div>
        ))}
      </div>

      <div className="status-viewer-header">
        <div className="status-viewer-user">
          <div className="status-viewer-avatar">{(group.profile.username || '?')[0].toUpperCase()}</div>
          <div>
            <div className="status-viewer-name">{isMine ? 'My status' : group.profile.username}</div>
            <div className="status-viewer-time">
              {new Date(current.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {isMine && (
            <button className="status-viewer-icon-btn" onClick={handleDelete} title="Delete">
              <IconTrash size={18} />
            </button>
          )}
          <button className="status-viewer-icon-btn" onClick={onClose} title="Close">
            <IconX size={20} />
          </button>
        </div>
      </div>

      <div className="status-viewer-body">
        {current.type === 'text' && (
          <div className="status-viewer-text" style={{ background: current.background || 'linear-gradient(135deg,#6c63ff,#a78bfa)' }}>
            {current.caption}
          </div>
        )}
        {current.type === 'image' && (
          <img className="status-viewer-media" src={getStatusMediaUrl(current.media_path)} alt="" />
        )}
        {current.type === 'video' && (
          <video className="status-viewer-media" src={getStatusMediaUrl(current.media_path)} autoPlay onEnded={advance} />
        )}
        {current.type !== 'text' && current.caption && (
          <div className="status-viewer-caption">{current.caption}</div>
        )}
      </div>

      <div className="status-viewer-nav">
        <button className="status-viewer-nav-zone status-viewer-nav-left" onClick={goBack} />
        <button className="status-viewer-nav-zone status-viewer-nav-right" onClick={advance} />
      </div>

      {isMine && viewers.length > 0 && (
        <div className="status-viewer-footer">
          👁 {viewers.length} view{viewers.length !== 1 ? 's' : ''}
        </div>
      )}
    </div>
  )
}
