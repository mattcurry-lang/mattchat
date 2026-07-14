import React, { useState, useEffect, useCallback } from 'react'
import { connectPinterest, listPinterestBoards, listPinterestPins, setAvatarFromUrl } from '../lib/supabase'

const e = React.createElement

const PROFESSIONAL_WORDS = ['work', 'career', 'business', 'professional', 'office', 'job', 'linkedin', 'portfolio', 'headshot', 'corporate']
const PERSONAL_WORDS = ['me', 'selfie', 'personal', 'aesthetic', 'mood', 'life', 'travel', 'friends', 'family', 'cute', 'style']

function scoreBoard(name, preference) {
  const lower = (name || '').toLowerCase()
  const words = preference === 'professional' ? PROFESSIONAL_WORDS : PERSONAL_WORDS
  return words.some(w => lower.includes(w)) ? 1 : 0
}

function ConnectPhase({ error, connecting, onConnect, onBack }) {
  return e('div', { style: { display: 'flex', flexDirection: 'column', gap: 12 } },
    e('div', { style: { fontSize: 13, color: 'var(--text-secondary)' } },
      'Connect your Pinterest account so you can pick a display picture from your own boards.'
    ),
    error ? e('div', { className: 'modal-error' }, error) : null,
    e('button', {
      className: 'btn-primary',
      disabled: connecting,
      onClick: onConnect,
    }, connecting ? 'Connecting…' : 'Connect Pinterest'),
    e('a', {
      href: 'https://www.pinterest.com/',
      target: '_blank',
      rel: 'noopener noreferrer',
      style: { fontSize: 12.5, color: 'var(--brand)', textAlign: 'center', textDecoration: 'none' },
    }, 'Don\u2019t have Pinterest? Get it here'),
    e('button', { className: 'btn-ghost', onClick: onBack }, 'Back')
  )
}

function BoardCard({ board, onOpenBoard }) {
  const children = []
  if (board.coverImage) {
    children.push(e('img', {
      key: 'img',
      src: board.coverImage,
      alt: '',
      style: { width: '100%', height: 80, objectFit: 'cover', borderRadius: 8 },
    }))
  }
  children.push(e('div', {
    key: 'name',
    style: { fontSize: 12.5, fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  }, board.name))
  children.push(e('div', {
    key: 'count',
    style: { fontSize: 11, color: 'var(--text-muted)' },
  }, board.pinCount + ' pins'))

  return e('button', {
    onClick: () => onOpenBoard(board),
    style: {
      border: '1px solid var(--border)', borderRadius: 12, padding: 8,
      background: 'var(--bg-surface-2)', cursor: 'pointer', textAlign: 'left',
      display: 'flex', flexDirection: 'column', gap: 6, fontFamily: 'inherit',
    },
  }, ...children)
}

function BoardsPhase({ boards, loading, error, preference, onOpenBoard, onBack }) {
  const label = 'Pick a board \u2014 sorted for ' + (preference === 'professional' ? 'professional' : 'personal') + ' use.'

  return e('div', { style: { display: 'flex', flexDirection: 'column', gap: 12 } },
    e('div', { style: { fontSize: 13, color: 'var(--text-secondary)', textAlign: 'center' } }, label),
    error ? e('div', { className: 'modal-error' }, error) : null,
    loading ? e('div', { className: 'loading-state' }, 'Loading boards…') : null,
    e('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, maxHeight: 320, overflowY: 'auto' } },
      ...boards.map(b => e(BoardCard, { key: b.id, board: b, onOpenBoard }))
    ),
    (!loading && boards.length === 0)
      ? e('div', { style: { fontSize: 13, color: 'var(--text-muted)', textAlign: 'center' } }, 'No boards found on your Pinterest account yet.')
      : null,
    e('button', { className: 'btn-ghost', onClick: onBack }, 'Back')
  )
}

function PinThumb({ pin, onPickPin, loading }) {
  return e('button', {
    onClick: () => onPickPin(pin),
    disabled: loading,
    title: pin.altText,
    style: { border: 'none', padding: 0, cursor: 'pointer', borderRadius: 10, overflow: 'hidden' },
  },
    e('img', {
      src: pin.imageUrl,
      alt: pin.altText,
      style: { width: '100%', height: 90, objectFit: 'cover', display: 'block' },
    })
  )
}

function PinsPhase({ activeBoard, pins, loading, error, onPickPin, onBackToBoards }) {
  return e('div', { style: { display: 'flex', flexDirection: 'column', gap: 12 } },
    e('div', { style: { display: 'flex', alignItems: 'center', gap: 8 } },
      e('button', { className: 'btn-ghost', style: { padding: '4px 10px' }, onClick: onBackToBoards }, '\u2190 Boards'),
      e('div', { style: { fontSize: 13, fontWeight: 700 } }, activeBoard ? activeBoard.name : '')
    ),
    error ? e('div', { className: 'modal-error' }, error) : null,
    loading ? e('div', { className: 'loading-state' }, 'Loading pins…') : null,
    e('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, maxHeight: 320, overflowY: 'auto' } },
      ...pins.map(p => e(PinThumb, { key: p.id, pin: p, onPickPin, loading }))
    ),
    (!loading && pins.length === 0)
      ? e('div', { style: { fontSize: 13, color: 'var(--text-muted)', textAlign: 'center' } }, 'This board has no pins yet — pick another.')
      : null
  )
}

export default function PinterestPicker({ session, userId, preference, onPicked, onBack }) {
  const [phase, setPhase] = useState('checking')
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
        const sorted = data.boards.slice().sort((a, b) => scoreBoard(b.name, preference) - scoreBoard(a.name, preference))
        setBoards(sorted)
        setPhase('boards')
      }
    } catch (err) {
      console.error(err)
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

  const pickPin = async (pin) => {
    setLoading(true)
    try {
      await setAvatarFromUrl(userId, pin.imageUrl)
      onPicked(pin.imageUrl)
    } catch (err) {
      setError('Could not set that as your picture. Please try again.')
      setLoading(false)
    }
  }

  let inner = null
  if (phase === 'connect') {
    inner = e(ConnectPhase, { error, connecting, onConnect: handleConnect, onBack })
  } else if (phase === 'boards') {
    inner = e(BoardsPhase, { boards, loading, error, preference, onOpenBoard: openBoard, onBack })
  } else if (phase === 'pins') {
    inner = e(PinsPhase, {
      activeBoard, pins, loading, error, onPickPin: pickPin,
      onBackToBoards: () => setPhase('boards'),
    })
  }

  return e('div', { style: { display: 'flex', flexDirection: 'column', gap: 12, width: '100%' } }, inner)
}
