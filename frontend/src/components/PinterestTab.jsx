import React, { useState, useEffect, useCallback } from 'react'
import { connectPinterest, listPinterestBoards, listPinterestPins } from '../lib/supabase'

// Same board/pin browsing flow as PinterestPicker.jsx, but the terminal
// action is "hand back a pin to send" instead of "set as avatar" — so
// this does NOT call setAvatarFromUrl. The parent (EmojiPicker) decides
// what to do with the picked pin via onPinSelect.
export default function PinterestTab({ session, onPinSelect }) {
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
        setBoards(data.boards)
        setPhase('boards')
      }
    } catch (err) {
      console.error(err)
      setError('Could not reach Pinterest. Please try again.')
      setPhase('connect')
    }
    setLoading(false)
  }, [session])

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
    } catch (err) {
      setError(err.message)
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
    } catch (err) {
      setError('Could not load pins from that board.')
    }
    setLoading(false)
  }

  // ── Connect phase ──
  if (phase === 'connect') {
    return (
      <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center', textAlign: 'center' }}>
        <div style={{ fontSize: 32 }}>📌</div>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>
          Connect Pinterest to send pins from your boards.
        </div>
        {error && <div style={{ fontSize: 12, color: '#f87171' }}>{error}</div>}
        <button
          onClick={handleConnect}
          disabled={connecting}
          style={{
            background: '#a78bfa', border: 'none', borderRadius: 10,
            color: '#181825', fontWeight: 700, fontSize: 13,
            padding: '9px 18px', cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          {connecting ? 'Connecting…' : 'Connect Pinterest'}
        </button>
      </div>
    )
  }

  // ── Boards phase ──
  if (phase === 'boards') {
    return (
      <div style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 8, overflowY: 'auto', flex: 1 }}>
        {loading && <div style={{ textAlign: 'center', fontSize: 12, color: 'rgba(255,255,255,0.4)', padding: 16 }}>Loading boards…</div>}
        {error && <div style={{ fontSize: 12, color: '#f87171', textAlign: 'center' }}>{error}</div>}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {boards.map(b => (
            <button
              key={b.id}
              onClick={() => openBoard(b)}
              style={{
                border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: 8,
                background: 'rgba(255,255,255,0.04)', cursor: 'pointer', textAlign: 'left',
                display: 'flex', flexDirection: 'column', gap: 6, fontFamily: 'inherit',
              }}
            >
              {b.coverImage && (
                <img src={b.coverImage} alt="" style={{ width: '100%', height: 70, objectFit: 'cover', borderRadius: 8 }} />
              )}
              <div style={{ fontSize: 12, fontWeight: 700, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {b.name}
              </div>
              <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.4)' }}>{b.pinCount} pins</div>
            </button>
          ))}
        </div>
        {!loading && boards.length === 0 && (
          <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.35)', textAlign: 'center', padding: 16 }}>
            No boards found yet.
          </div>
        )}
      </div>
    )
  }

  // ── Pins phase ──
  return (
    <div style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 8, overflowY: 'auto', flex: 1 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button
          onClick={() => setPhase('boards')}
          style={{
            background: 'none', border: 'none', color: '#a78bfa', fontSize: 12,
            fontWeight: 700, cursor: 'pointer', padding: '4px 6px', fontFamily: 'inherit',
          }}
        >
          ← Boards
        </button>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: '#fff' }}>{activeBoard?.name}</div>
      </div>
      {loading && <div style={{ textAlign: 'center', fontSize: 12, color: 'rgba(255,255,255,0.4)', padding: 16 }}>Loading pins…</div>}
      {error && <div style={{ fontSize: 12, color: '#f87171', textAlign: 'center' }}>{error}</div>}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
        {pins.map(p => (
          <button
            key={p.id}
            onClick={() => onPinSelect(p)}
            title={p.altText}
            style={{ border: 'none', padding: 0, cursor: 'pointer', borderRadius: 8, overflow: 'hidden' }}
          >
            <img src={p.imageUrl} alt={p.altText} style={{ width: '100%', height: 80, objectFit: 'cover', display: 'block' }} />
          </button>
        ))}
      </div>
      {!loading && pins.length === 0 && (
        <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.35)', textAlign: 'center', padding: 16 }}>
          This board has no pins yet.
        </div>
      )}
    </div>
  )
}
