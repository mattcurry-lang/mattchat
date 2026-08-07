import React, { useState, useEffect, useCallback } from 'react'
import { X } from 'lucide-react'
import { getComments, postComment } from '../../lib/shortsSupabase'

export default function ShortsCommentsSheet({ video, userId, onClose, onCommentPosted }) {
  const [comments, setComments] = useState([])
  const [loading, setLoading] = useState(true)
  const [text, setText] = useState('')
  const [posting, setPosting] = useState(false)

  useEffect(() => {
    let cancelled = false
    getComments(video.videoId).then(data => { if (!cancelled) { setComments(data); setLoading(false) } })
    return () => { cancelled = true }
  }, [video.videoId])

  const handlePost = useCallback(async () => {
    const trimmed = text.trim()
    if (!trimmed || posting) return
    setPosting(true)
    const newComment = await postComment(userId, video.videoId, trimmed)
    if (newComment) {
      setComments(prev => [newComment, ...prev])
      setText('')
      onCommentPosted?.()
    }
    setPosting(false)
  }, [text, posting, userId, video.videoId, onCommentPosted])

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 800, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'flex-end' }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: '100%', maxHeight: '72vh', background: 'rgba(20,20,32,0.94)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)',
        borderTopLeftRadius: 24, borderTopRightRadius: 24, border: '1px solid rgba(255,255,255,0.1)',
        display: 'flex', flexDirection: 'column', animation: 'sheetUp 0.28s cubic-bezier(0.34,1.56,0.64,1)',
      }}>
        <div style={{ width: 36, height: 4, background: 'rgba(255,255,255,0.25)', borderRadius: 4, margin: '10px auto 4px' }} />
        <div style={{ padding: '8px 20px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <h3 style={{ fontSize: 15, fontWeight: 800, color: '#fff', margin: 0 }}>{comments.length} comment{comments.length !== 1 ? 's' : ''}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', display: 'flex' }}><X size={18} /></button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {loading && <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, textAlign: 'center', padding: 20 }}>Loading comments…</div>}
          {!loading && comments.length === 0 && <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, textAlign: 'center', padding: 20 }}>No comments yet — say something.</div>}
          {comments.map((c) => (
            <div key={c.id} style={{ display: 'flex', gap: 10 }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', flexShrink: 0, background: 'linear-gradient(135deg,#667eea,#764ba2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, color: '#fff' }}>
                {(c.profiles?.username || '?').charAt(0).toUpperCase()}
              </div>
              <div>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: '#fff' }}>{c.profiles?.username || 'User'}</div>
                <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.85)', marginTop: 2 }}>{c.text}</div>
              </div>
            </div>
          ))}
        </div>

        <div style={{ padding: '10px 20px 20px', display: 'flex', gap: 8, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
          <input
            value={text} onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handlePost()}
            placeholder="Add a comment…"
            style={{ flex: 1, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 20, padding: '10px 16px', color: '#fff', fontSize: 13, fontFamily: 'inherit' }}
          />
          <button
            onClick={handlePost} disabled={!text.trim() || posting}
            style={{ background: 'linear-gradient(135deg,#667eea,#764ba2)', border: 'none', borderRadius: 20, color: '#fff', fontSize: 13, fontWeight: 700, padding: '0 18px', cursor: 'pointer', fontFamily: 'inherit', opacity: !text.trim() ? 0.4 : 1 }}
          >
            Post
          </button>
        </div>
      </div>
      <style>{`@keyframes sheetUp { from { transform: translateY(100%); } to { transform: translateY(0); } }`}</style>
    </div>
  )
}
