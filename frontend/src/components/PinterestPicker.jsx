import React, { useState, useEffect, useCallback } from 'react'
import { connectPinterest, listPinterestBoards, listPinterestPins, setAvatarFromUrl } from '../lib/supabase'

const PROFESSIONAL_WORDS = ['work', 'career', 'business', 'professional', 'office', 'job', 'linkedin', 'portfolio', 'headshot', 'corporate']
const PERSONAL_WORDS = ['me', 'selfie', 'personal', 'aesthetic', 'mood', 'life', 'travel', 'friends', 'family', 'cute', 'style']

function scoreBoard(name, preference) {
  const lower = (name || '').toLowerCase()
  const words = preference === 'professional' ? PROFESSIONAL_WORDS : PERSONAL_WORDS
  return words.some(w => lower.includes(w)) ? 1 : 0
}

function ConnectPhase({ error, connecting, onConnect, onBack }) {
  return (
    <React.Fragment>
      <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
        Connect your Pinterest account so you can pick a display picture from your own boards.
      </div>
      {error && <div className="modal-error">{error}</div>}
      <button className="btn-primary" disabled={connecting} onClick={onConnect}>
        {connecting ? '📌 Connecting…' : '📌 Connect Pinterest'}
      </button>
      
        href="https://www.pinterest.com/"
        target="_blank"
        rel="noopener noreferrer"
        style={{ fontSize: 12.5, color: 'var(--brand)', textAlign: 'center', textDecoration: 'none' }}
      >
        Don't have Pinterest? Get it here →
      </a>
      <button className="btn-ghost" onClick={onBack}>Back</button>
    </React.Fragment>
  )
}

function BoardsPhase({ boards, loading, error, preference, onOpenBoard, onBack }) {
  return (
    <React.Fragment>
      <div style={{ fontSize: 13, color: 'var(--text-secondary)', textAlign: 'center' }}>
        Pick a board — sorted for {preference === 'professional' ? 'professional' : 'personal'} use.
      </div>
      {error && <div className="modal-error">{error}</div>}
      {loading && <div className="loading-state">Loading boards…</div>}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, maxHeight: 320, overflowY: 'auto' }}>
        {boards.map(b => (
          <button
            key={b.id}
            onClick={() => onOpenBoard(b)}
            style={{
              border: '1px solid var(--border)', borderRadius: 12, padding: 8,
              background: 'var(--bg-surface-2)', cursor: 'pointer', textAlign: 'left',
              display: 'flex', flexDirection: 'column', gap: 6, fontFamily: 'inherit',
            }}
          >
            {b.coverImage && (
              <img src={b.coverImage} alt="" style={{ width: '100%', height: 80, objectFit: 'cover', borderRadius: 8 }} />
            )}
            <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {b.name}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{b.pinCount} pins</div>
          </button>
        ))}
      </div>
      {!loading && boards.length === 0 && (
        <div style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center' }}>
          No boards found on your Pinterest account yet.
        </div>
      )}
      <button className="btn-ghost" onClick={onBack}>Back</button>
    </React.Fragment>
  )
}

function PinsPhase({ activeBoard, pins, loading, error, onPickPin, onBackToBoards }) {
  return (
    <React.Fragment>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button className="btn-ghost" style={{ padding: '4px 10px' }} onClick={onBackToBoards}>← Boards</button>
        <div style={{ fontSize: 13, fontWeight: 700 }}>{activeBoard ? activeBoard.name : ''}</div>
      </div>
      {error && <div className="modal-error">{error}</div>}
      {loading && <div className="loading-state">Loading pins…</div>}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, maxHeight: 320, overflowY: 'auto' }}>
        {pins.map(p => (
          <button
            key={p.id}
            onClick={() => onPickPin(p)}
            disabled={loading}
            style={{ border: 'none', padding: 0, cursor: 'pointer', borderRadius: 10, overflow: 'hidden' }}
            title={p.altText}
          >
            <img src={p.imageUrl} alt={p.altText} style={{ width: '100%', height: 90, objectFit: 'cover', display: 'block' }} />
          </button>
        ))}
      </div>
      {!loading && pins.length === 0 && (
        <div style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center' }}>
          This board has no pins yet — pick another.
        </div>
      )}
    </React.Fragment>
  )
}

export default function PinterestPicker({ session, userId, preference, onPicked, onBack }) {
  const [phase, setPhase] = useState('checking') // checking | connect | boards | pins
  const [boards, setBoards] = useState([])
  const [pins, setPins] = useState([])
  const [activeBoard, setActiveBoard] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [connecting, setConnecting] = useState(false)

  const checkConnection = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = await listPinterestBoards(session)
      if (!data.ok) throw new Error(data.error || 'Could not check Pinterest connection')
      if (!data.connected) {
        setPhase('connect')
      } else {
        const sorted = [...data.boards].sort((a, b) => scoreBoard(b.name, preference) - scoreBoard(a.name, preference))
        setBoards(sorted)
        setPhase('boards')
      }
    } catch (e) {
      console.error(e)
      setError('Could not reach Pinterest. Please try again.')
      setPhase('connect')
    }
    setLoading(false)
  }, [session, preference])

  useEffect(() => { checkConnection() }, [checkConnection])

  useEffect(() => {
    const handler = () => checkConnection()
    window.addEventListener('pinterest-connected', handler)
    return () => window.removeEventListener('pinterest-connected', handler)
  }, [checkConnection])

  const handleConnect = async () => {
    setConnecting(true)
    try {
      await connectPinterest(session)
    } catch (e) {
      setError(e.message)
      setConnecting(false)
    }
  }

  const openBoard = async (board) => {
    setActiveBoard(board)
    setPhase('pins')
    setLoading(true)
    setError('')
    try {
      const data = await listPinterestPins(session, board.id)
      if (!data.ok) throw new Error(data.error || 'Could not load pins')
      setPins(data.pins)
    } catch (e) {
      setError('Could not load pins from that board.')
    }
    setLoading(false)
  }

  const pickPin = async (pin) => {
    setLoading(true)
    try {
      await setAvatarFromUrl(userId, pin.imageUrl)
      onPicked(pin.imageUrl)
    } catch (e) {
      setError('Could not set that as your picture. Please try again.')
      setLoading(false)
    }
  }

  let content = null
  if (phase === 'connect') {
    content = (
      <ConnectPhase
        error={error}
        connecting={connecting}
        onConnect={handleConnect}
        onBack={onBack}
      />
    )
  } else if (phase === 'boards') {
    content = (
      <BoardsPhase
        boards={boards}
        loading={loading}
        error={error}
        preference={preference}
        onOpenBoard={openBoard}
        onBack={onBack}
      />
    )
  } else if (phase === 'pins') {
    content = (
      <PinsPhase
        activeBoard={activeBoard}
        pins={pins}
        loading={loading}
        error={error}
        onPickPin={pickPin}
        onBackToBoards={() => setPhase('boards')}
      />
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%' }}>
      {content}
    </div>
  )
}
