import React, { useState } from 'react'

export default function NearbyShopButton({ searchCategory, label }) {
  const [locating, setLocating] = useState(false)
  const [error, setError] = useState(null)

  const findNearby = () => {
    if (!navigator.geolocation) {
      setError('Location isn\'t available in this browser.')
      return
    }
    setLocating(true)
    setError(null)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords
        const query = encodeURIComponent(searchCategory)
        // Google Maps search centered on the user's actual location —
        // works without any API key, opens their preferred maps app on mobile.
        const url = `https://www.google.com/maps/search/${query}/@${latitude},${longitude},14z`
        window.open(url, '_blank', 'noopener,noreferrer')
        setLocating(false)
      },
      (err) => {
        console.error('geolocation failed:', err)
        setError('Could not get your location — check location permissions.')
        setLocating(false)
      },
      { timeout: 10000 }
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <button
        onClick={findNearby}
        disabled={locating}
        style={{
          display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(167,139,250,0.14)',
          border: '1px solid rgba(167,139,250,0.3)', borderRadius: 20, padding: '6px 12px',
          color: '#c4b5fd', fontSize: 11.5, fontWeight: 700, cursor: locating ? 'default' : 'pointer',
          fontFamily: 'inherit', opacity: locating ? 0.6 : 1,
        }}
      >
        📍 {locating ? 'Finding nearby…' : (label || 'Find nearby')}
      </button>
      {error && <div style={{ fontSize: 10.5, color: '#f87171' }}>{error}</div>}
    </div>
  )
}
