import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { connectPinterest, listPinterestBoards, listPinterestPins, setAvatarFromUrl } from '../lib/supabase'

const CATEGORY_WORDS = {
  professional: ['work', 'career', 'business', 'professional', 'office', 'job', 'linkedin', 'portfolio', 'headshot', 'corporate'],
  personal:     ['me', 'selfie', 'personal', 'aesthetic', 'mood', 'life', 'cute', 'style'],
  minimal:      ['minimal', 'simple', 'clean', 'aesthetic', 'monochrome'],
  gaming:       ['gaming', 'game', 'gamer', 'esports', 'console', 'pixel'],
  ai_avatar:    ['ai', 'avatar', 'digital art', 'render', 'character', 'generated'],
  photography:  ['photography', 'photo', 'camera', 'portrait', 'shot'],
  anime:        ['anime', 'manga', 'anime art', 'anime icon', 'chibi'],
  nature:       ['nature', 'landscape', 'forest', 'mountains', 'scenery', 'plants'],
  animals:      ['animals', 'dog', 'cat', 'pets', 'wildlife', 'puppy'],
  cars:         ['cars', 'car', 'automotive', 'jdm', 'supercar'],
  sports:       ['sports', 'football', 'basketball', 'soccer', 'fitness', 'gym'],
  music:        ['music', 'concert', 'guitar', 'vinyl', 'band', 'artist'],
}

function scoreBoard(name, category) {
  const lower = (name || '').toLowerCase()
  const words = CATEGORY_WORDS[category] || CATEGORY_WORDS.personal
  return words.some((w) => lower.includes(w)) ? 1 : 0
}

const STYLES = `
@keyframes pp-shimmer { 0% { background-position: -300px 0 } 100% { background-position: 300px 0 } }
@keyframes pp-spin { to { transform: rotate(360deg) } }
@keyframes pp-pop { from { opacity: 0; transform: translateY(8px) } to { opacity: 1; transform: none } }
.pp-skel { border-radius: 12px; background: linear-gradient(90deg, rgba(255,255,255,0.05) 25%, rgba(255,255,255,0.11) 37%, rgba(255,255,255,0.05) 63%); background-size: 600px 100%; animation: pp-shimmer 1.3s infinite linear; }
.pp-card { transition: transform .15s ease, border-color .15s ease; }
.pp-card:hover { transform: translateY(-2px); border-color: rgba(167,139,250,0.6) !important; }
.pp-pin img { transition: transform .2s ease; }
.pp-pin:hover img { transform: scale(1.07); }
.pp-fade { animation: pp-pop .25s ease both; }
`

const grid = (min) => ({ display: 'grid', gridTemplateColumns: `repeat(auto-fill, minmax(${min}px, 1fr))`, gap: 10 })
const scroller = { maxHeight: 'min(52vh, 380px)', overflowY: 'auto', paddingRight: 2 }

function PinterestMark({ size = 60 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="12" fill="#e60023" />
      <text x="12" y="17.2" textAnchor="middle" fontSize="14" fontWeight="800" fill="#fff" fontFamily="Arial, sans-serif">P</text>
    </svg>
  )
}

function Spinner({ size = 16 }) {
  return (
    <span style={{ width: size, height: size, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.35)', borderTopColor: '#fff', display: 'inline-block', animation: 'pp-spin .8s linear infinite' }} />
  )
}

function Header({ title, subtitle, onBack, onSkip }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      {onBack && (
        <button onClick={onBack} aria-label="Back" className="btn-ghost" style={{ padding: '6px 12px', flexShrink: 0 }}>←</button>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</div>
        {subtitle && <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 1 }}>{subtitle}</div>}
      </div>
      {onSkip && (
        <button onClick={onSkip} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', padding: '8px 4px', flexShrink: 0 }}>
          Skip
        </button>
      )}
    </div>
  )
}

function ErrorBox({ message, onRetry }) {
  if (!message) return null
  return (
    <div className="modal-error" role="alert" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
      <span>{message}</span>
      {onRetry && (
        <button onClick={onRetry} style={{ background: 'none', border: '1px solid currentColor', color: 'inherit', borderRadius: 999, fontSize: 12, fontWeight: 700, padding: '3px 12px', cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>
          Retry
        </button>
      )}
    </div>
  )
}

export default function PinterestPicker({ session, userId, preference, onPicked, onBack, onSkip }) {
  const [phase, setPhase] = useState('checking') // checking | connect | boards | pins | preview
  const [boards, setBoards] = useState([])
  const [pins, setPins] = useState([])
  const [activeBoard, setActiveBoard] = useState(null)
  const [selectedPin, setSelectedPin] = useState(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [error, setError] = useState('')
  const [boardQuery, setBoardQuery] = useState('')
  const pinsReq = useRef(0)

  const checkConnection = useCallback(async () => {
    setPhase('checking')
    setError('')
    try {
      const data = await listPinterestBoards(session)
      if (!data.ok) throw new Error(data.error || 'Could not check Pinterest connection')
      if (!data.connected) { setPhase('connect'); return }
      const sorted = (data.boards || []).slice().sort((a, b) => scoreBoard(b.name, preference) - scoreBoard(a.name, preference))
      setBoards(sorted)
      setPhase('boards')
    } catch (err) {
      console.error(err)
      setError('Could not reach Pinterest. Check your connection and try again.')
      setPhase('connect')
    }
  }, [session, preference])

  useEffect(() => { checkConnection() }, [checkConnection])

  useEffect(() => {
    const handler = () => { setConnecting(false); checkConnection() }
    window.addEventListener('pinterest-connected', handler)
    return () => window.removeEventListener('pinterest-connected', handler)
  }, [checkConnection])

  const handleConnect = async () => {
    setConnecting(true)
    setError('')
    try {
      await connectPinterest(session)
    } catch (err) {
      setError(err.message || 'Could not start the Pinterest connection.')
      setConnecting(false)
    }
  }

  const openBoard = async (board) => {
    const id = ++pinsReq.current
    setActiveBoard(board)
    setPins([])
    setError('')
    setLoading(true)
    setPhase('pins')
    try {
      const data = await listPinterestPins(session, board.id)
      if (!data.ok) throw new Error(data.error || 'Could not load pins')
      if (id === pinsReq.current) setPins(data.pins || [])
    } catch (err) {
      console.error(err)
      if (id === pinsReq.current) setError('Could not load pins from that board.')
    }
    if (id === pinsReq.current) setLoading(false)
  }

  const confirmPick = async () => {
    if (!selectedPin || saving) return
    setSaving(true)
    setError('')
    try {
      await setAvatarFromUrl(userId, selectedPin.imageUrl)
      onPicked(selectedPin.imageUrl)
    } catch (err) {
      console.error(err)
      setError('Could not set that as your picture. Please try again.')
      setSaving(false)
    }
  }

  const visibleBoards = useMemo(() => {
    const q = boardQuery.trim().toLowerCase()
    return q ? boards.filter((b) => (b.name || '').toLowerCase().includes(q)) : boards
  }, [boards, boardQuery])

  let body = null

  if (phase === 'checking') {
    body = (
      <>
        <Header title="Pinterest" subtitle="Checking your connection…" onBack={onBack} onSkip={onSkip} />
        <div style={grid(130)}>
          {[0, 1, 2, 3].map((i) => <div key={i} className="pp-skel" style={{ height: 118 }} />)}
        </div>
      </>
    )
  }

  if (phase === 'connect') {
    body = (
      <div className="pp-fade" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, textAlign: 'center' }}>
        <PinterestMark />
        <div>
          <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)' }}>Use a picture from Pinterest</div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 6, lineHeight: 1.5 }}>
            Browse your own boards and pick any pin as your profile picture. You'll hop over to Pinterest to approve, then come straight back.
          </div>
        </div>
        <div style={{ width: '100%' }}><ErrorBox message={error} onRetry={error.startsWith('Could not reach') ? checkConnection : null} /></div>
        <button className="btn-primary" disabled={connecting} onClick={handleConnect} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          {connecting && <Spinner />}{connecting ? 'Connecting…' : 'Connect Pinterest'}
        </button>
        <a href="https://www.pinterest.com/" target="_blank" rel="noopener noreferrer" style={{ fontSize: 12.5, color: 'var(--brand)', textDecoration: 'none' }}>
          Don’t have Pinterest? Get it here
        </a>
        <div style={{ display: 'flex', gap: 8, width: '100%' }}>
          {onBack && <button className="btn-ghost" onClick={onBack} style={{ flex: 1 }}>Back</button>}
          {onSkip && <button className="btn-ghost" onClick={onSkip} style={{ flex: 1 }}>Skip for now</button>}
        </div>
      </div>
    )
  }

  if (phase === 'boards') {
    body = (
      <>
        <Header title="Choose a board" subtitle="Boards that match your style come first" onBack={onBack} onSkip={onSkip} />
        <ErrorBox message={error} />
        {boards.length > 6 && (
          <input
            value={boardQuery}
            onChange={(e) => setBoardQuery(e.target.value)}
            placeholder="Search your boards"
            aria-label="Search your boards"
            style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg-surface-2)', color: 'var(--text-primary)', fontFamily: 'inherit', fontSize: 13.5, outline: 'none' }}
          />
        )}
        <div style={{ ...grid(130), ...scroller }}>
          {visibleBoards.map((b) => {
            const suggested = scoreBoard(b.name, preference) > 0
            return (
              <button key={b.id} className="pp-card pp-fade" onClick={() => openBoard(b)}
                style={{ border: '1px solid var(--border)', borderRadius: 14, padding: 8, background: 'var(--bg-surface-2)', cursor: 'pointer', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 6, fontFamily: 'inherit' }}>
                <div style={{ position: 'relative', width: '100%', height: 86, borderRadius: 9, overflow: 'hidden', background: 'linear-gradient(135deg, rgba(102,126,234,0.35), rgba(118,75,162,0.35))' }}>
                  {b.coverImage && <img src={b.coverImage} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} onError={(e) => { e.currentTarget.style.display = 'none' }} />}
                  {suggested && (
                    <span style={{ position: 'absolute', top: 6, left: 6, fontSize: 9.5, fontWeight: 800, letterSpacing: 0.3, padding: '2px 7px', borderRadius: 999, color: '#fff', background: 'rgba(124,58,237,0.92)' }}>SUGGESTED</span>
                  )}
                </div>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.name}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{b.pinCount} pins</div>
              </button>
            )
          })}
        </div>
        {boards.length === 0 && (
          <div style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', padding: '14px 0' }}>No boards found on your Pinterest account yet.</div>
        )}
        {boards.length > 0 && visibleBoards.length === 0 && (
          <div style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', padding: '14px 0' }}>No boards match “{boardQuery}”.</div>
        )}
      </>
    )
  }

  if (phase === 'pins') {
    body = (
      <>
        <Header
          title={activeBoard ? activeBoard.name : 'Pins'}
          subtitle="Tap a pin to preview it"
          onBack={() => { setError(''); setPhase('boards') }}
          onSkip={onSkip}
        />
        <ErrorBox message={error} onRetry={activeBoard ? () => openBoard(activeBoard) : null} />
        <div style={{ ...grid(92), ...scroller }}>
          {loading && [0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => <div key={i} className="pp-skel" style={{ aspectRatio: '1 / 1' }} />)}
          {!loading && pins.map((p) => (
            <button key={p.id} className="pp-pin pp-fade" title={p.altText} aria-label={p.altText || 'Pin'}
              onClick={() => { setSelectedPin(p); setError(''); setPhase('preview') }}
              style={{ border: 'none', padding: 0, cursor: 'pointer', borderRadius: 12, overflow: 'hidden', aspectRatio: '1 / 1', background: 'var(--bg-surface-2)' }}>
              <img src={p.imageUrl} alt={p.altText || ''} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} onError={(e) => { e.currentTarget.style.visibility = 'hidden' }} />
            </button>
          ))}
        </div>
        {!loading && !error && pins.length === 0 && (
          <div style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', padding: '14px 0' }}>This board has no pins yet. Pick another one.</div>
        )}
      </>
    )
  }

  if (phase === 'preview' && selectedPin) {
    body = (
      <div className="pp-fade" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, textAlign: 'center' }}>
        <div style={{ width: '100%' }}>
          <Header title="Use this picture?" onBack={saving ? null : () => { setError(''); setPhase('pins') }} onSkip={saving ? null : onSkip} />
        </div>
        <div style={{ padding: 4, borderRadius: '50%', background: 'linear-gradient(135deg,#667eea,#764ba2)', boxShadow: '0 12px 32px rgba(118,75,162,0.4)' }}>
          <img src={selectedPin.imageUrl} alt="Preview" style={{ width: 150, height: 150, borderRadius: '50%', objectFit: 'cover', display: 'block', border: '4px solid var(--bg-surface-1, #14141f)' }} />
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>This is how you'll look in chats. You can change it any time.</div>
        <div style={{ width: '100%' }}><ErrorBox message={error} /></div>
        <button className="btn-primary" disabled={saving} onClick={confirmPick} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          {saving && <Spinner />}{saving ? 'Saving…' : 'Use this picture'}
        </button>
        <button className="btn-ghost" disabled={saving} onClick={() => { setError(''); setPhase('pins') }} style={{ width: '100%' }}>Choose another</button>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, width: '100%' }}>
      <style>{STYLES}</style>
      {body}
    </div>
  )
}
