import React, { useState, useEffect, useRef, useCallback } from 'react'
import {
  getStatusViewers, deleteStatus, getStatusMediaUrl,
  toggleStatusReaction, getStatusReactions, replyToStatus,
} from '../lib/supabase'
import { IconX, IconTrash } from './Icons'

// Only used for text/image statuses — video statuses drive their own
// progress off real playback time instead (see handleVideoTimeUpdate),
// since a fixed timer was cutting videos off mid-play whenever they
// ran longer than this.
const DURATION_MS = 7000

// currentUserId is required now — needed to attribute reactions/replies
// to the person actually viewing, and to look up whether *they've*
// already liked the current status (so the heart button shows filled
// vs outline correctly).
export default function StatusViewer({ group, isMine, currentUserId, onClose, onViewed, onDeleted, onNextGroup, onPrevGroup }) {
  const [index, setIndex] = useState(0)
  const [progress, setProgress] = useState(0)
  const [paused, setPaused] = useState(false)
  const [viewers, setViewers] = useState([])
  const [mediaUrl, setMediaUrl] = useState(null)
  const [reactions, setReactions] = useState([])
  const [liked, setLiked] = useState(false)
  const [showHeartBurst, setShowHeartBurst] = useState(false)
  const [replyText, setReplyText] = useState('')
  const [replySending, setReplySending] = useState(false)
  const [replySent, setReplySent] = useState(false)
  const rafRef = useRef(null)
  const startRef = useRef(null)
  const lastTapRef = useRef(0)

  const statuses = group.statuses
  const current = statuses[index]
  const mediaReady = current.type === 'text' || !!mediaUrl

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
    setReplyText('')
    setReplySent(false)
    onViewed?.(current.id)
    if (isMine) getStatusViewers(current.id).then(setViewers)
  }, [current, isMine, onViewed])

  // Load this status's reactions whenever it changes — both to show
  // the owner who reacted, and to know if the current viewer already
  // liked it (so the heart button renders correctly on open).
  useEffect(() => {
    let cancelled = false
    getStatusReactions(current.id).then(data => {
      if (cancelled) return
      setReactions(data)
      setLiked(data.some(r => r.user_id === currentUserId))
    })
    return () => { cancelled = true }
  }, [current, currentUserId])

  useEffect(() => {
    let cancelled = false
    setMediaUrl(null)
    if (current.type !== 'text' && current.media_path) {
      getStatusMediaUrl(current.media_path).then(url => {
        if (!cancelled) setMediaUrl(url)
      })
    }
    return () => { cancelled = true }
  }, [current])

  // This fixed-duration timer now ONLY drives text/image statuses.
  // Video statuses skip it entirely and instead update progress off
  // the actual <video> element's currentTime/duration (see
  // handleVideoTimeUpdate + handleVideoEnded below) — otherwise a
  // video longer than DURATION_MS was getting cut off mid-play.
  useEffect(() => {
    if (current.type === 'video') return
    if (paused || !mediaReady) { cancelAnimationFrame(rafRef.current); return }
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
  }, [current, paused, mediaReady])

  // Video's own progress bar — ties directly to real playback
  // position, so the bar (and the eventual advance) always matches
  // how long the video actually is, however long that is.
  const handleVideoTimeUpdate = (e) => {
    const v = e.target
    if (v.duration) setProgress(v.currentTime / v.duration)
  }
  const handleVideoEnded = () => advance()

  const handleDelete = async () => {
    if (!window.confirm('Delete this status?')) return
    await deleteStatus(current.id)
    onDeleted?.(current.id)
    if (statuses.length <= 1) onClose()
    else advance()
  }

  // Shared toggle used by both the heart button and double-tap.
  // Can't like your own status — same rule as everywhere else.
  const toggleLike = useCallback(async () => {
    if (isMine) return
    const wasLiked = liked
    setLiked(!wasLiked) // optimistic
    try {
      const { liked: nowLiked } = await toggleStatusReaction(current.id, currentUserId, '❤️')
      setLiked(nowLiked)
      const fresh = await getStatusReactions(current.id)
      setReactions(fresh)
    } catch (e) {
      setLiked(wasLiked) // revert on failure
      console.error('toggleStatusReaction failed:', e)
    }
  }, [isMine, liked, current, currentUserId])

  const handleLikeButton = () => {
    toggleLike()
    if (!liked) {
      setShowHeartBurst(true)
      setTimeout(() => setShowHeartBurst(false), 700)
    }
  }

  // Double-tap on the media itself — same 300ms-window convention as
  // Instagram/WhatsApp. Only ever LIKES (never un-likes) on double-tap,
  // since that matches what people expect double-tap-to-like to do.
  const handleBodyClick = () => {
    const now = Date.now()
    if (now - lastTapRef.current < 300) {
      if (!liked) {
        toggleLike()
        setShowHeartBurst(true)
        setTimeout(() => setShowHeartBurst(false), 700)
      }
      lastTapRef.current = 0
    } else {
      lastTapRef.current = now
    }
  }

  const handleSendReply = async () => {
    if (!replyText.trim() || replySending) return
    setReplySending(true)
    try {
      await replyToStatus(currentUserId, group.userId, current.caption, replyText.trim())
      setReplyText('')
      setReplySent(true)
      setTimeout(() => setReplySent(false), 2000)
    } catch (e) {
      alert('Could not send reply: ' + e.message)
    }
    setReplySending(false)
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

      <div className="status-viewer-body" onClick={handleBodyClick}>
        {current.type === 'text' && (
          <div className="status-viewer-text" style={{ background: current.background || 'linear-gradient(135deg,#6c63ff,#a78bfa)' }}>
            {current.caption}
          </div>
        )}
        {current.type === 'image' && (
          mediaUrl
            ? <img className="status-viewer-media" src={mediaUrl} alt="" />
            : <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13.5 }}>Loading…</div>
        )}
        {current.type === 'video' && (
          mediaUrl
            ? (
              <video
                className="status-viewer-media"
                src={mediaUrl}
                autoPlay
                playsInline
                onTimeUpdate={handleVideoTimeUpdate}
                onEnded={handleVideoEnded}
                onPause={() => { if (!paused) setPaused(true) }}
                onPlay={() => setPaused(false)}
              />
            )
            : <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13.5 }}>Loading…</div>
        )}
        {current.type !== 'text' && current.caption && (
          <div className="status-viewer-caption">{current.caption}</div>
        )}

        {/* Double-tap heart burst animation */}
        {showHeartBurst && (
          <div className="status-heart-burst">❤️</div>
        )}
      </div>

      {/* Nav zones sit UNDER the like/reply controls in z-index, so
          double-tap still works on the body but taps at the very
          bottom (on the reply bar) don't trigger prev/next. */}
      <div className="status-viewer-nav">
        <button className="status-viewer-nav-zone status-viewer-nav-left" onClick={goBack} />
        <button className="status-viewer-nav-zone status-viewer-nav-right" onClick={advance} />
      </div>

      {/* Owner view: viewers + who reacted, instead of a reply bar
          (you can't reply to or like your own status) */}
      {isMine ? (
        <div className="status-viewer-footer status-viewer-footer-mine">
          {viewers.length > 0 && (
            <div>👁 {viewers.length} view{viewers.length !== 1 ? 's' : ''}</div>
          )}
          {reactions.length > 0 && (
            <div className="status-reactions-summary">
              ❤️ {reactions.length} like{reactions.length !== 1 ? 's' : ''}
              {reactions.slice(0, 3).map(r => r.profiles?.username).filter(Boolean).length > 0 && (
                <span className="status-reactions-names">
                  {' '}— {reactions.slice(0, 3).map(r => r.profiles?.username).filter(Boolean).join(', ')}
                  {reactions.length > 3 ? ` +${reactions.length - 3} more` : ''}
                </span>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="status-viewer-reply-bar">
          <button
            className={`status-like-btn ${liked ? 'liked' : ''}`}
            onClick={handleLikeButton}
            title={liked ? 'Unlike' : 'Like'}
          >
            {liked ? '❤️' : '🤍'}
          </button>
          <input
            className="status-reply-input"
            value={replyText}
            onChange={e => setReplyText(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleSendReply() }}
            placeholder={replySent ? 'Sent ✓' : `Reply to ${group.profile.username || 'status'}…`}
            disabled={replySending}
          />
          <button
            className="status-reply-send"
            onClick={handleSendReply}
            disabled={!replyText.trim() || replySending}
          >
            ➤
          </button>
        </div>
      )}
    </div>
  )
}
