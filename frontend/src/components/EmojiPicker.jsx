import React, { useState, useEffect, useRef, useCallback } from 'react'

// ── Emoji Data ────────────────────────────────────────────────
const EMOJI_CATEGORIES = [
  {
    id: 'recent', label: 'Recent', icon: '🕐',
    emojis: [], // filled from localStorage
  },
  {
    id: 'smileys', label: 'Smileys & People', icon: '😀',
    emojis: [
      '😀','😃','😄','😁','😆','😅','🤣','😂','🙂','🙃','😉','😊','😇','🥰','😍','🤩',
      '😘','😗','😚','😙','🥲','😋','😛','😜','🤪','😝','🤑','🤗','🤭','🤫','🤔','🤐',
      '🤨','😐','😑','😶','😏','😒','🙄','😬','🤥','😌','😔','😪','🤤','😴','😷','🤒',
      '🤕','🤢','🤧','🥵','🥶','🥴','😵','💫','🤯','🤠','🥳','🥸','😎','🤓','🧐','😕',
      '😟','🙁','☹️','😮','😯','😲','😳','🥺','😦','😧','😨','😰','😥','😢','😭','😱',
      '😖','😣','😞','😓','😩','😫','🥱','😤','😡','😠','🤬','😈','👿','💀','☠️','💩',
      '🤡','👹','👺','👻','👽','👾','🤖','😺','😸','😹','😻','😼','😽','🙀','😿','😾',
      '👋','🤚','🖐️','✋','🖖','👌','🤌','🤏','✌️','🤞','🤟','🤘','🤙','👈','👉','👆',
      '🖕','👇','☝️','👍','👎','✊','👊','🤛','🤜','👏','🙌','👐','🤲','🤝','🙏','✍️',
      '💅','🤳','💪','🦾','🦿','🦵','🦶','👂','🦻','👃','🫀','🫁','🧠','🦷','🦴','👀',
      '👁️','👅','👄','💋','🩸','👶','🧒','👦','👧','🧑','👱','👨','🧔','👩','🧓','👴','👵',
    ],
  },
  {
    id: 'animals', label: 'Animals & Nature', icon: '🐶',
    emojis: [
      '🐶','🐱','🐭','🐹','🐰','🦊','🐻','🐼','🐻‍❄️','🐨','🐯','🦁','🐮','🐷','🐸','🐵',
      '🙈','🙉','🙊','🐒','🐔','🐧','🐦','🐤','🦆','🦅','🦉','🦇','🐺','🐗','🐴','🦄',
      '🐝','🐛','🦋','🐌','🐞','🐜','🦟','🦗','🦂','🐢','🐍','🦎','🦖','🦕','🐙','🦑',
      '🦐','🦞','🦀','🐡','🐠','🐟','🐬','🐳','🐋','🦈','🐊','🐅','🐆','🦓','🦍','🦧',
      '🦣','🐘','🦛','🦏','🐪','🐫','🦒','🦘','🦬','🐃','🐂','🐄','🐎','🐖','🐏','🐑',
      '🦙','🐐','🦌','🐕','🐩','🦮','🐈','🐓','🦃','🦤','🦚','🦜','🦩','🕊️','🐇','🦝',
      '🌸','🌺','🌻','🌹','🌷','🌼','💐','🍀','🌿','🌱','🌲','🌳','🌴','🌵','🎋','🎍',
    ],
  },
  {
    id: 'food', label: 'Food & Drink', icon: '🍕',
    emojis: [
      '🍎','🍊','🍋','🍇','🍓','🫐','🍈','🍒','🍑','🥭','🍍','🥥','🥝','🍅','🍆','🥑',
      '🥦','🥬','🥒','🌶️','🫑','🧄','🧅','🥔','🍠','🥐','🥯','🍞','🥖','🥨','🧀','🥚',
      '🍳','🧈','🥞','🧇','🥓','🥩','🍗','🍖','🌭','🍔','🍟','🍕','🫓','🥙','🧆','🌮',
      '🌯','🫔','🥗','🥘','🫕','🍲','🍛','🍜','🍝','🍠','🍢','🍣','🍤','🍙','🍚','🍱',
      '🥟','🦪','🍤','🍙','🍚','🍘','🍥','🥮','🍡','🧁','🍰','🎂','🍮','🍭','🍬','🍫',
      '🍿','🍩','🍪','🌰','🥜','🍯','🧃','🥤','🧋','☕','🫖','🍵','🧉','🍺','🍻','🥂',
      '🍷','🥃','🍸','🍹','🧊','🍾','🥄','🍴','🍽️','🥢','🧂',
    ],
  },
  {
    id: 'activity', label: 'Activities', icon: '⚽',
    emojis: [
      '⚽','🏀','🏈','⚾','🥎','🎾','🏐','🏉','🥏','🎱','🏓','🏸','🏒','🥍','🏑','🏏',
      '🪃','🥅','⛳','🪁','🏹','🎣','🤿','🥊','🥋','🎽','🛹','🛼','🛷','⛸️','🥌','🎿',
      '⛷️','🏂','🪂','🏋️','🤼','🤸','⛹️','🤺','🏇','🧘','🏄','🏊','🤽','🚣','🧗','🚵',
      '🚴','🏆','🥇','🥈','🥉','🏅','🎖️','🏵️','🎗️','🎫','🎟️','🎪','🎭','🎨','🎬','🎤',
      '🎧','🎼','🎹','🥁','🪘','🎷','🎺','🎸','🪕','🎻','🎲','♟️','🎯','🎳','🎮','🎰',
      '🧩','🪅','🪆','♠️','♥️','♦️','♣️','🃏','🀄','🎴',
    ],
  },
  {
    id: 'travel', label: 'Travel & Places', icon: '✈️',
    emojis: [
      '🚗','🚕','🚙','🚌','🚎','🏎️','🚓','🚑','🚒','🚐','🛻','🚚','🚛','🚜','🦯','🦽',
      '🦼','🛴','🚲','🛵','🏍️','🛺','🚨','🚔','🚍','🚘','🚖','🚡','🚠','🚟','🚃','🚋',
      '🚞','🚝','🚄','🚅','🚈','🚂','🚆','🚇','🚊','🚉','✈️','🛫','🛬','🛩️','💺','🛰️',
      '🚀','🛸','🚁','🛶','⛵','🚤','🛥️','🛳️','⛴️','🚢','⚓','🗺️','🗾','🧭','🏔️','⛰️',
      '🌋','🗻','🏕️','🏖️','🏜️','🏝️','🏞️','🏟️','🏛️','🏗️','🏘️','🏚️','🏠','🏡','🏢','🏣',
      '🏤','🏥','🏦','🏨','🏩','🏪','🏫','🏭','🏯','🏰','💒','🗼','🗽','⛪','🕌','🛕',
      '🕍','⛩️','🕋','⛲','⛺','🌁','🌃','🏙️','🌄','🌅','🌆','🌇','🌉','♾️','🎠','🎡',
    ],
  },
  {
    id: 'objects', label: 'Objects', icon: '💡',
    emojis: [
      '💝','💘','💖','💗','💓','💞','💕','💟','❣️','💔','❤️','🧡','💛','💚','💙','💜',
      '🖤','🤍','🤎','💯','💢','💥','💫','💦','💨','🕳️','💬','💭','💤','👓','🕶️','🥽',
      '🌂','☂️','🧵','🪡','🧶','🪢','👑','👒','🎩','🧢','⛑️','📿','💄','💍','💎','📱',
      '💻','⌨️','🖥️','🖨️','🖱️','🖲️','💾','💿','📀','🧮','📷','📸','📹','🎥','📽️','🎞️',
      '📞','☎️','📟','📠','📺','📻','🧭','⏱️','⏲️','⏰','🕰️','⌛','⏳','📡','🔋','🔌',
      '💡','🔦','🕯️','🪔','🧯','🛢️','💰','💴','💵','💶','💷','💸','💳','🪙','💹','📈',
      '📉','📊','📋','📌','📍','✂️','🗃️','🗳️','🗄️','🗑️','🔒','🔓','🔏','🔐','🔑','🗝️',
    ],
  },
  {
    id: 'symbols', label: 'Symbols', icon: '❤️',
    emojis: [
      '❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','❤️‍🔥','❤️‍🩹','💯','✅','❎','🔴','🟠',
      '🟡','🟢','🔵','🟣','⚫','⚪','🟤','🔶','🔷','🔸','🔹','🔺','🔻','💠','🔘','🔳',
      '🔲','▪️','▫️','◾','◽','◼️','◻️','⬛','⬜','🟥','🟧','🟨','🟩','🟦','🟪','⭕',
      '✖️','➕','➖','➗','♾️','💲','💱','‼️','⁉️','❓','❔','❕','❗','〰️','🔅','🔆',
      '🎵','🎶','🔇','🔈','🔉','🔊','📣','📢','🔔','🔕','🃏','🎴','♀️','♂️','⚧️','✔️',
      '☑️','🔃','🔄','🔙','🔚','🔛','🔜','🔝','🛐','⚛️','🕉️','✡️','☸️','☯️','✝️','☦️',
    ],
  },
]

// ── Built-in Sticker Packs (using emoji combos rendered as styled stickers) ──
const STICKER_PACKS = [
  {
    id: 'love', name: '💕 Love', stickers: [
      { id: 'love1', emoji: '🥰', label: 'Loving it' },
      { id: 'love2', emoji: '😍', label: 'Heart eyes' },
      { id: 'love3', emoji: '💘', label: 'Cupid' },
      { id: 'love4', emoji: '💝', label: 'Gift heart' },
      { id: 'love5', emoji: '💖', label: 'Sparkling' },
      { id: 'love6', emoji: '💌', label: 'Love letter' },
      { id: 'love7', emoji: '🌹', label: 'Rose' },
      { id: 'love8', emoji: '💑', label: 'Couple' },
      { id: 'love9', emoji: '👫', label: 'Together' },
      { id: 'love10', emoji: '🫶', label: 'Heart hands' },
      { id: 'love11', emoji: '💏', label: 'Kiss' },
      { id: 'love12', emoji: '🥂', label: 'Celebrate' },
    ]
  },
  {
    id: 'mood', name: '😎 Moods', stickers: [
      { id: 'mood1', emoji: '😎', label: 'Cool' },
      { id: 'mood2', emoji: '🥳', label: 'Party' },
      { id: 'mood3', emoji: '😤', label: 'Annoyed' },
      { id: 'mood4', emoji: '🤯', label: 'Mind blown' },
      { id: 'mood5', emoji: '😴', label: 'Sleepy' },
      { id: 'mood6', emoji: '🤩', label: 'Starstruck' },
      { id: 'mood7', emoji: '😭', label: 'Crying' },
      { id: 'mood8', emoji: '🥺', label: 'Pleading' },
      { id: 'mood9', emoji: '😏', label: 'Smirk' },
      { id: 'mood10', emoji: '🤭', label: 'Giggling' },
      { id: 'mood11', emoji: '🫠', label: 'Melting' },
      { id: 'mood12', emoji: '🤌', label: 'Chef\'s kiss' },
    ]
  },
  {
    id: 'reactions', name: '👍 Reactions', stickers: [
      { id: 'r1', emoji: '👍', label: 'Thumbs up' },
      { id: 'r2', emoji: '👎', label: 'Thumbs down' },
      { id: 'r3', emoji: '🙌', label: 'Raised hands' },
      { id: 'r4', emoji: '👏', label: 'Clapping' },
      { id: 'r5', emoji: '🔥', label: 'Fire' },
      { id: 'r6', emoji: '💯', label: '100' },
      { id: 'r7', emoji: '🫡', label: 'Salute' },
      { id: 'r8', emoji: '🤝', label: 'Handshake' },
      { id: 'r9', emoji: '✌️', label: 'Peace' },
      { id: 'r10', emoji: '🤙', label: 'Call me' },
      { id: 'r11', emoji: '💪', label: 'Strong' },
      { id: 'r12', emoji: '🎉', label: 'Party!' },
    ]
  },
  {
    id: 'animals', name: '🐾 Animals', stickers: [
      { id: 'a1', emoji: '🐶', label: 'Dog' },
      { id: 'a2', emoji: '🐱', label: 'Cat' },
      { id: 'a3', emoji: '🐸', label: 'Frog' },
      { id: 'a4', emoji: '🐼', label: 'Panda' },
      { id: 'a5', emoji: '🦊', label: 'Fox' },
      { id: 'a6', emoji: '🐨', label: 'Koala' },
      { id: 'a7', emoji: '🦋', label: 'Butterfly' },
      { id: 'a8', emoji: '🐧', label: 'Penguin' },
      { id: 'a9', emoji: '🦄', label: 'Unicorn' },
      { id: 'a10', emoji: '🐙', label: 'Octopus' },
      { id: 'a11', emoji: '🐻', label: 'Bear' },
      { id: 'a12', emoji: '🦁', label: 'Lion' },
    ]
  },
  {
    id: 'vibes', name: '✨ Vibes', stickers: [
      { id: 'v1', emoji: '✨', label: 'Sparkles' },
      { id: 'v2', emoji: '🌈', label: 'Rainbow' },
      { id: 'v3', emoji: '⚡', label: 'Energy' },
      { id: 'v4', emoji: '🌙', label: 'Moon' },
      { id: 'v5', emoji: '☀️', label: 'Sunny' },
      { id: 'v6', emoji: '🌸', label: 'Blossom' },
      { id: 'v7', emoji: '🎆', label: 'Fireworks' },
      { id: 'v8', emoji: '🍀', label: 'Lucky' },
      { id: 'v9', emoji: '💫', label: 'Dizzy' },
      { id: 'v10', emoji: '🎊', label: 'Confetti' },
      { id: 'v11', emoji: '🌺', label: 'Hibiscus' },
      { id: 'v12', emoji: '🪄', label: 'Magic' },
    ]
  },
]

const TENOR_KEY = 'y4WBZCY6Y4LjpD7tPGpYtyVR2vuYdiDW'
const TENOR_BASE = 'https://api.giphy.com/v2'

// Curated GIF categories using Tenor search
const GIF_CATEGORIES = [
  '🔥 Trending', '😂 Funny', '🎉 Celebrate', '😍 Love',
  '👋 Hello', '😢 Sad', '😎 Cool', '🙏 Thank you',
  '👍 Agree', '🤔 Thinking', '😴 Sleepy', '🤯 Shocked',
]

// ── Sticker component ─────────────────────────────────────────
function StickerItem({ sticker, onSelect, size = 72 }) {
  const [hovered, setHovered] = useState(false)
  return (
    <button
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => onSelect(sticker)}
      style={{
        background: hovered ? 'rgba(99,102,241,0.12)' : 'rgba(255,255,255,0.04)',
        border: `1.5px solid ${hovered ? 'rgba(99,102,241,0.3)' : 'rgba(255,255,255,0.06)'}`,
        borderRadius: 14,
        padding: 8,
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 4,
        transition: 'all 0.15s',
        transform: hovered ? 'scale(1.08)' : 'scale(1)',
        width: size + 16,
      }}
      title={sticker.label}
    >
      <span style={{ fontSize: size * 0.65, lineHeight: 1, filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.3))' }}>
        {sticker.emoji}
      </span>
      <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', fontWeight: 600, letterSpacing: '0.02em', maxWidth: size, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {sticker.label}
      </span>
    </button>
  )
}

// ── GIF component ─────────────────────────────────────────────
function GifGrid({ query, onSelect }) {
  const [gifs, setGifs] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const debounceRef = useRef(null)

  // Fetch gifs from Tenor
  const fetchGifs = useCallback(async (q) => {
    setLoading(true)
    setError(null)
    try {
      const endpoint = q
        ? `${TENOR_BASE}/search?q=${encodeURIComponent(q)}&key=${TENOR_KEY}&limit=24&media_filter=gif`
        : `${TENOR_BASE}/featured?key=${TENOR_KEY}&limit=24&media_filter=gif`
      const res = await fetch(endpoint)
      const data = await res.json()

      if (data.error) throw new Error(data.error.message || 'API error')

      const results = (data.results || []).map(r => ({
        id: r.id,
        url: r.media_formats?.gif?.url || r.media_formats?.tinygif?.url,
        preview: r.media_formats?.tinygif?.url || r.media_formats?.gif?.url,
        width: r.media_formats?.tinygif?.dims?.[0] || 120,
        height: r.media_formats?.tinygif?.dims?.[1] || 120,
        title: r.content_description || '',
      }))
      setGifs(results)
    } catch (err) {
      // Fallback: show placeholder GIF tiles when API isn't set up
      setError('Set up your Tenor API key to enable GIF search.')
      setGifs([])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => fetchGifs(query), 400)
    return () => clearTimeout(debounceRef.current)
  }, [query, fetchGifs])

  if (loading) return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, padding: 8 }}>
      {Array(12).fill(0).map((_, i) => (
        <div key={i} style={{
          width: 110, height: 80, borderRadius: 8,
          background: 'rgba(255,255,255,0.06)',
          animation: 'shimmer 1.2s infinite',
        }} />
      ))}
    </div>
  )

  if (error) return (
    <div style={{ padding: 24, textAlign: 'center', color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>
      <div style={{ fontSize: 32, marginBottom: 8 }}>🎬</div>
      <div style={{ fontWeight: 600, marginBottom: 4 }}>GIF Search</div>
      <div style={{ fontSize: 12, lineHeight: 1.5 }}>
        Get a free API key at{' '}
        <a href="https://tenor.com/developer/keyregistration" target="_blank" rel="noreferrer"
          style={{ color: '#667eea' }}>tenor.com</a>
        {' '}and replace <code style={{ background: 'rgba(255,255,255,0.08)', padding: '1px 4px', borderRadius: 4 }}>TENOR_KEY</code> in EmojiPicker.jsx
      </div>
    </div>
  )

  if (gifs.length === 0) return (
    <div style={{ padding: 32, textAlign: 'center', color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>
      No GIFs found for "{query}"
    </div>
  )

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, padding: 8 }}>
      {gifs.map(gif => (
        <button
          key={gif.id}
          onClick={() => onSelect(gif)}
          style={{
            background: 'none', border: 'none', padding: 0, cursor: 'pointer',
            borderRadius: 8, overflow: 'hidden', flexShrink: 0,
            transition: 'transform 0.15s, opacity 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.04)'; e.currentTarget.style.opacity = '0.9' }}
          onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.opacity = '1' }}
          title={gif.title}
        >
          <img
            src={gif.preview}
            alt={gif.title}
            style={{ width: 110, height: 80, objectFit: 'cover', display: 'block' }}
            loading="lazy"
          />
        </button>
      ))}
    </div>
  )
}

// ── Main EmojiPicker ──────────────────────────────────────────
export default function EmojiPicker({ onEmojiSelect, onStickerSelect, onGifSelect, onClose }) {
  const [tab, setTab] = useState('emoji')           // emoji | stickers | gifs
  const [emojiCategory, setEmojiCategory] = useState('smileys')
  const [stickerPack, setStickerPack] = useState('love')
  const [search, setSearch] = useState('')
  const [gifQuery, setGifQuery] = useState('')
  const [gifCategory, setGifCategory] = useState('')
  const [recentEmojis, setRecentEmojis] = useState([])
  const [skinTone, setSkinTone] = useState('') // '' | '🏻' | '🏼' | '🏽' | '🏾' | '🏿'
  const [showSkinTone, setShowSkinTone] = useState(false)
  const pickerRef = useRef(null)
  const searchRef = useRef(null)

  // Load recent emojis from localStorage
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('mattchat_recent_emojis') || '[]')
      setRecentEmojis(saved)
      EMOJI_CATEGORIES[0].emojis = saved
    } catch {}
  }, [])

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target)) onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  // Focus search when switching to GIFs
  useEffect(() => {
    if (tab === 'gifs') searchRef.current?.focus()
  }, [tab])

  const addToRecent = (emoji) => {
    const next = [emoji, ...recentEmojis.filter(e => e !== emoji)].slice(0, 32)
    setRecentEmojis(next)
    EMOJI_CATEGORIES[0].emojis = next
    try { localStorage.setItem('mattchat_recent_emojis', JSON.stringify(next)) } catch {}
  }

  const handleEmojiClick = (emoji) => {
    addToRecent(emoji)
    onEmojiSelect(emoji)
  }

  const handleStickerClick = (sticker) => {
    onStickerSelect(sticker)
  }

  const handleGifClick = (gif) => {
    onGifSelect(gif)
    onClose()
  }

  // Filter emojis by search
  const getFilteredEmojis = () => {
    if (!search.trim()) {
      const cat = EMOJI_CATEGORIES.find(c => c.id === emojiCategory)
      return cat?.emojis || []
    }
    // Search across all categories
    return EMOJI_CATEGORIES.flatMap(c => c.emojis).filter(e => {
      // Simple search - emoji itself or basic unicode search
      return e.includes(search)
    }).slice(0, 64)
  }

  const SKIN_TONES = ['', '🏻', '🏼', '🏽', '🏾', '🏿']
  const SKIN_COLORS = ['#ffd83d', '#ffd6c4', '#e8b88a', '#c47e52', '#8d5524', '#4a2e1f']

  const tabs = [
    { id: 'emoji', icon: '😀', label: 'Emoji' },
    { id: 'stickers', icon: '🎭', label: 'Stickers' },
    { id: 'gifs', icon: '🎬', label: 'GIFs' },
  ]

  return (
    <div
      ref={pickerRef}
      style={{
        position: 'absolute',
        bottom: 'calc(100% + 8px)',
        left: 0,
        width: 360,
        maxHeight: 440,
        background: '#1e1e2e',
        borderRadius: 18,
        border: '1px solid rgba(99,102,241,0.2)',
        boxShadow: '0 -8px 40px rgba(0,0,0,0.5), 0 0 0 1px rgba(99,102,241,0.1)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        zIndex: 300,
        animation: 'pickerPop 0.2s cubic-bezier(0.34,1.56,0.64,1)',
      }}
    >
      <style>{`
        @keyframes pickerPop {
          from { opacity: 0; transform: scale(0.92) translateY(8px); }
          to   { opacity: 1; transform: none; }
        }
        @keyframes shimmer {
          0%   { background-color: rgba(255,255,255,0.06); }
          50%  { background-color: rgba(255,255,255,0.10); }
          100% { background-color: rgba(255,255,255,0.06); }
        }
        .emoji-btn:hover { background: rgba(99,102,241,0.15) !important; transform: scale(1.18); }
        .emoji-btn:active { transform: scale(0.95); }
        ::-webkit-scrollbar { width: 3px; }
        ::-webkit-scrollbar-thumb { background: rgba(99,102,241,0.3); border-radius: 3px; }
      `}</style>

      {/* ── Top tabs ── */}
      <div style={{
        display: 'flex',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        background: '#181825',
        flexShrink: 0,
      }}>
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              flex: 1, padding: '11px 8px',
              background: 'none', border: 'none',
              cursor: 'pointer', fontFamily: 'inherit',
              fontSize: 13, fontWeight: 700,
              color: tab === t.id ? '#a78bfa' : 'rgba(255,255,255,0.4)',
              borderBottom: `2px solid ${tab === t.id ? '#a78bfa' : 'transparent'}`,
              transition: 'all 0.15s',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}
          >
            <span style={{ fontSize: 16 }}>{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── EMOJI TAB ── */}
      {tab === 'emoji' && (
        <>
          {/* Search + skin tone */}
          <div style={{ padding: '8px 10px', display: 'flex', gap: 8, flexShrink: 0 }}>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search emoji…"
              style={{
                flex: 1, background: 'rgba(255,255,255,0.07)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 10, padding: '7px 12px',
                color: '#fff', fontSize: 13, outline: 'none', fontFamily: 'inherit',
              }}
            />
            {/* Skin tone picker */}
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setShowSkinTone(v => !v)}
                style={{
                  width: 34, height: 34, borderRadius: 10,
                  background: SKIN_COLORS[SKIN_TONES.indexOf(skinTone)] || '#ffd83d',
                  border: '2px solid rgba(255,255,255,0.15)',
                  cursor: 'pointer', flexShrink: 0,
                }}
                title="Skin tone"
              />
              {showSkinTone && (
                <div style={{
                  position: 'absolute', top: '100%', right: 0, marginTop: 4,
                  background: '#2a2a3e', borderRadius: 10, padding: 6,
                  display: 'flex', gap: 4, zIndex: 10,
                  border: '1px solid rgba(255,255,255,0.1)',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
                }}>
                  {SKIN_TONES.map((tone, i) => (
                    <button
                      key={i}
                      onClick={() => { setSkinTone(tone); setShowSkinTone(false) }}
                      style={{
                        width: 24, height: 24, borderRadius: '50%',
                        background: SKIN_COLORS[i],
                        border: skinTone === tone ? '2px solid #a78bfa' : '2px solid transparent',
                        cursor: 'pointer',
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Category pills */}
          {!search && (
            <div style={{
              display: 'flex', gap: 4, padding: '0 10px 8px',
              overflowX: 'auto', flexShrink: 0,
            }}>
              {EMOJI_CATEGORIES.map(cat => (
                cat.id === 'recent' && recentEmojis.length === 0 ? null : (
                  <button
                    key={cat.id}
                    onClick={() => setEmojiCategory(cat.id)}
                    style={{
                      background: emojiCategory === cat.id ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.04)',
                      border: `1px solid ${emojiCategory === cat.id ? 'rgba(99,102,241,0.4)' : 'rgba(255,255,255,0.08)'}`,
                      borderRadius: 20, padding: '4px 10px',
                      cursor: 'pointer', fontSize: 18, flexShrink: 0,
                      transition: 'all 0.12s',
                    }}
                    title={cat.label}
                  >
                    {cat.icon}
                  </button>
                )
              ))}
            </div>
          )}

          {/* Emoji grid */}
          <div style={{ overflowY: 'auto', padding: '4px 8px 8px', flex: 1 }}>
            {!search && (
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', fontWeight: 700,
                textTransform: 'uppercase', letterSpacing: '0.06em', padding: '4px 4px 6px' }}>
                {EMOJI_CATEGORIES.find(c => c.id === emojiCategory)?.label}
              </div>
            )}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(8, 1fr)',
              gap: 2,
            }}>
              {getFilteredEmojis().map((emoji, i) => (
                <button
                  key={`${emoji}-${i}`}
                  className="emoji-btn"
                  onClick={() => handleEmojiClick(emoji)}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    fontSize: 24, padding: '5px 2px', borderRadius: 8,
                    lineHeight: 1, transition: 'all 0.1s',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                  title={emoji}
                >
                  {emoji}
                </button>
              ))}
              {getFilteredEmojis().length === 0 && search && (
                <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: 20,
                  color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>
                  No emoji found
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* ── STICKERS TAB ── */}
      {tab === 'stickers' && (
        <>
          {/* Pack selector */}
          <div style={{
            display: 'flex', gap: 4, padding: '8px 10px',
            overflowX: 'auto', flexShrink: 0,
            borderBottom: '1px solid rgba(255,255,255,0.06)',
          }}>
            {STICKER_PACKS.map(pack => (
              <button
                key={pack.id}
                onClick={() => setStickerPack(pack.id)}
                style={{
                  background: stickerPack === pack.id ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${stickerPack === pack.id ? 'rgba(99,102,241,0.4)' : 'rgba(255,255,255,0.08)'}`,
                  borderRadius: 20, padding: '5px 12px',
                  cursor: 'pointer', fontSize: 12, fontWeight: 600,
                  color: stickerPack === pack.id ? '#a78bfa' : 'rgba(255,255,255,0.5)',
                  flexShrink: 0, transition: 'all 0.12s', fontFamily: 'inherit',
                  whiteSpace: 'nowrap',
                }}
              >
                {pack.name}
              </button>
            ))}
          </div>

          {/* Sticker grid */}
          <div style={{ overflowY: 'auto', padding: 10, flex: 1 }}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: 8,
            }}>
              {STICKER_PACKS.find(p => p.id === stickerPack)?.stickers.map(sticker => (
                <StickerItem
                  key={sticker.id}
                  sticker={sticker}
                  onSelect={handleStickerClick}
                  size={64}
                />
              ))}
            </div>
          </div>
        </>
      )}

      {/* ── GIFS TAB ── */}
      {tab === 'gifs' && (
        <>
          {/* GIF search */}
          <div style={{ padding: '8px 10px', flexShrink: 0 }}>
            <input
              ref={searchRef}
              value={gifQuery}
              onChange={e => setGifQuery(e.target.value)}
              placeholder="Search GIFs…"
              style={{
                width: '100%', background: 'rgba(255,255,255,0.07)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 10, padding: '8px 12px',
                color: '#fff', fontSize: 13, outline: 'none',
                fontFamily: 'inherit', boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Category chips */}
          {!gifQuery && (
            <div style={{
              display: 'flex', gap: 4, padding: '0 10px 8px',
              overflowX: 'auto', flexShrink: 0,
            }}>
              {GIF_CATEGORIES.map(cat => (
                <button
                  key={cat}
                  onClick={() => setGifQuery(cat.replace(/^.*? /, ''))}
                  style={{
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 20, padding: '4px 10px',
                    cursor: 'pointer', fontSize: 12, fontWeight: 600,
                    color: 'rgba(255,255,255,0.6)', flexShrink: 0,
                    transition: 'all 0.12s', fontFamily: 'inherit',
                    whiteSpace: 'nowrap',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(99,102,241,0.15)'; e.currentTarget.style.color = '#a78bfa' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = 'rgba(255,255,255,0.6)' }}
                >
                  {cat}
                </button>
              ))}
            </div>
          )}

          {/* GIF grid */}
          <div style={{ overflowY: 'auto', flex: 1 }}>
            <GifGrid query={gifQuery} onSelect={handleGifClick} />
          </div>

          <div style={{ padding: '4px 10px 6px', textAlign: 'right' }}>
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)' }}>Powered by Tenor</span>
          </div>
        </>
      )}
    </div>
  )
}
