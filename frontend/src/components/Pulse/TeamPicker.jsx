import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { usePlTeamsList } from '../../hooks/useFootballData'

function CrestImage({ src, name, size = 42 }) {
  const [failed, setFailed] = useState(false)
  if (!src || failed) {
    return (
      <div
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          background: 'rgba(255,255,255,0.08)',
          border: '1px solid rgba(255,255,255,0.15)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 16,
          fontWeight: 800,
          color: '#a78bfa',
          boxShadow: '0 4px 10px rgba(0,0,0,0.2)',
        }}
      >
        {(name || '?').trim().charAt(0).toUpperCase()}
      </div>
    )
  }
  return (
    <img
      src={src}
      alt={name}
      onError={() => setFailed(true)}
      draggable={false}
      style={{
        width: size,
        height: size,
        objectFit: 'contain',
        filter: 'drop-shadow(0 6px 12px rgba(0,0,0,0.35))',
        transition: 'transform 0.2s ease',
      }}
    />
  )
}

export default function TeamPicker({ onSelect, selectedTeamId }) {
  const { teams, loading, error } = usePlTeamsList()
  const [hoveredId, setHoveredId] = useState(null)

  return (
    <div
      style={{
        position: 'relative',
        borderRadius: 24,
        padding: '24px 20px',
        background: 'linear-gradient(160deg, rgba(30, 25, 54, 0.9) 0%, rgba(18, 16, 27, 0.95) 100%)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: '1px solid rgba(167,139,250,0.25)',
        boxShadow: '0 20px 50px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
        overflow: 'hidden',
        color: '#fff',
      }}
    >
      {/* Stadium Ambient Glow */}
      <div
        style={{
          position: 'absolute',
          top: '-40px',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '240px',
          height: '100px',
          background: 'radial-gradient(circle, rgba(167,139,250,0.25) 0%, transparent 70%)',
          pointerEvents: 'none',
          filter: 'blur(30px)',
        }}
      />

      {/* Header Title Section */}
      <div style={{ textAlign: 'center', marginBottom: 20, position: 'relative', zIndex: 1 }}>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 11,
            fontWeight: 800,
            color: '#c4b5fd',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            background: 'rgba(167,139,250,0.14)',
            padding: '5px 14px',
            borderRadius: 20,
            border: '1px solid rgba(167,139,250,0.25)',
            marginBottom: 8,
          }}
        >
          <span>⚽</span> Matchday Companion
        </div>
        <h2 style={{ fontSize: 20, fontWeight: 900, color: '#fff', margin: 0, letterSpacing: '-0.02em' }}>
          Pledge Your Loyalty
        </h2>
        <p style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.6)', margin: '4px 0 0', fontWeight: 500 }}>
          Select your club to customize live scores, alerts & fixture match centres.
        </p>
      </div>

      {loading && (
        <div style={{ padding: '36px 0', textAlign: 'center', fontSize: 13, color: '#c4b5fd', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
          <div style={{ width: 16, height: 16, border: '2px solid rgba(167,139,250,0.3)', borderTopColor: '#a78bfa', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
          Gathering Premier League clubs...
        </div>
      )}

      {error && (
        <div style={{ padding: 14, background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)', borderRadius: 14, fontSize: 13, color: '#f87171', textAlign: 'center' }}>
          {error}
        </div>
      )}

      {!loading && !error && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(92px, 1fr))',
            gap: 12,
            maxHeight: '360px',
            overflowY: 'auto',
            padding: '4px 4px 8px',
            position: 'relative',
            zIndex: 1,
          }}
        >
          {teams.map((t, index) => {
            const isSelected = selectedTeamId === t.id
            const isHovered = hoveredId === t.id
            return (
              <motion.button
                key={t.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(index * 0.02, 0.3), duration: 0.2 }}
                whileHover={{ scale: 1.05, translateY: -3 }}
                whileTap={{ scale: 0.95 }}
                onMouseEnter={() => setHoveredId(t.id)}
                onMouseLeave={() => setHoveredId(null)}
                onClick={() => onSelect(t.id)}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  padding: '14px 8px',
                  borderRadius: 18,
                  border: isSelected
                    ? '2px solid #a78bfa'
                    : isHovered
                    ? '1px solid rgba(167,139,250,0.4)'
                    : '1px solid rgba(255,255,255,0.08)',
                  background: isSelected
                    ? 'linear-gradient(135deg, rgba(167,139,250,0.25) 0%, rgba(108,99,255,0.15) 100%)'
                    : isHovered
                    ? 'rgba(255,255,255,0.07)'
                    : 'rgba(255,255,255,0.03)',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  boxShadow: isSelected
                    ? '0 8px 20px rgba(108,99,255,0.35)'
                    : isHovered
                    ? '0 6px 16px rgba(0,0,0,0.3)'
                    : 'none',
                  transition: 'background 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease',
                  position: 'relative',
                }}
              >
                <CrestImage src={t.crest} name={t.name} size={42} />
                <span
                  style={{
                    fontSize: 11.5,
                    fontWeight: 700,
                    color: isSelected ? '#a78bfa' : '#f8fafc',
                    textAlign: 'center',
                    lineHeight: 1.2,
                    maxWidth: '100%',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {t.shortName || t.name}
                </span>

                {isSelected && (
                  <span
                    style={{
                      position: 'absolute',
                      top: 6,
                      right: 6,
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      background: '#a78bfa',
                      boxShadow: '0 0 8px #a78bfa',
                    }}
                  />
                )}
              </motion.button>
            )
          })}
        </div>
      )}
    </div>
  )
}
