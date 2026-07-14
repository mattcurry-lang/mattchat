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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
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
        {"Don't have Pinterest? Get it here"}
      </a>
      <button className="btn-ghost" onClick={onBack}>Back</button>
    </div>
  )
}

function BoardsPhase({ boards, loading, error, preference, onOpenBoard, onBack }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ fontSize: 13, color: 'var(--text-secondary)', textAlign: 'center' }}>
        {'Pick a board — sorted for ' + (preference === 'professional' ? 'professional' : 'personal') + ' use.'}
      </div>
      {error && <div className="modal-error">{error}</div>}
      {loading && <div className="loading-state">Loading boards…</div>}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, maxHeight: 320, overflowY: 'auto' }}>
        {boards.map(function (b) {
          return (
            <button
              key={b.id}
              onClick={function () { onOpenBoard(b) }}
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
          )
        })}
      </div>
      {!loading && boards.length === 0 && (
        <div style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center' }}>
          No boards found on your Pinterest account yet.
        </div>
      )}
      <button className="btn-ghost" onClick={onBack}>Back</button>
    </div>
  )
}

function PinsPhase({ activeBoard, pins, loading, error, onPickPin, onBackToBoards }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button className="btn-ghost" style={{ padding: '4px 10px' }} onClick={onBackToBoards}>
          {'← Boards'}
        </button>
        <div style={{ fontSize: 13, fontWeight: 700 }}>{activeBoard ? activeBoard.name : ''}</div>
      </div>
      {error && <div className="modal-error">{error}</div>}
      {loading && <div className="loading-state">Loading pins…</div>}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, maxHeight: 320, overflowY: 'auto' }}>
        {pins.map(function (p) {
          return (
            <button
              key={p.id}
              onClick={function () { onPickPin(p) }}
              disabled={loading}
              style={{ border: 'none', padding: 0, cursor: 'pointer', borderRadius: 10, overflow: 'hidden' }}
              title={p.altText}
            >
              <img src={p.imageUrl} alt={p.altText} style={{ width: '100%', height: 90, objectFit: 'cover', display: 'block' }} />
            </button>
