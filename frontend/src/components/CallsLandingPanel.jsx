// CallsLandingPanel.jsx
// Right-pane hero shown when the Calls tab is active and no conversation
// is open — Mattchat's version of WhatsApp desktop's "Voice and video
// calling" panel. "Call a number" and "New call link" are intentionally
// left out: Mattchat calls are conversation-based via Daily.js rooms,
// not PSTN dialing or shareable join-links — including fake buttons for
// capabilities that don't exist would be worse than leaving them out.

import React from 'react'
import { IconPhone, IconVideo } from './Icons'

export default function CallsLandingPanel({ onStartCall }) {
  return (
    <div style={styles.wrap}>
      <div style={styles.iconOrbit}>
        <div style={styles.ring} />
        <div style={styles.iconGlow}><IconVideo size={34} /></div>
      </div>
      <h2 style={styles.title}>Voice and video calling</h2>
      <p style={styles.sub}>Crystal-clear calls, right inside Mattchat — no extra app, no phone number needed.</p>
      <button onClick={onStartCall} style={styles.cta}>
        <IconPhone size={16} /> Start a call
      </button>
      <div style={styles.encryptedNote}>🔒 Calls are private to you and the people you're talking to</div>
    </div>
  )
}

const styles = {
  wrap: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', textAlign: 'center', padding: '0 32px' },
  iconOrbit: { position: 'relative', width: 100, height: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  ring: { position: 'absolute', inset: 0, borderRadius: '50%', border: '1px dashed rgba(148,120,255,0.3)' },
  iconGlow: {
    width: 76, height: 76, borderRadius: '50%',
    background: 'linear-gradient(135deg, rgba(127,95,255,0.22), rgba(200,109,215,0.16))',
    display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#c9c0ff',
  },
  title: { fontSize: 22, fontWeight: 800, color: '#f2f0f8', margin: '0 0 8px' },
  sub: { fontSize: 13.5, color: 'rgba(228,224,240,0.55)', maxWidth: 320, lineHeight: 1.5, margin: '0 0 24px' },
  cta: {
    display: 'flex', alignItems: 'center', gap: 8, padding: '11px 22px', borderRadius: 999, border: 'none',
    background: 'linear-gradient(135deg,#7F5FFF,#C86DD7)', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit',
  },
  encryptedNote: { marginTop: 28, fontSize: 11.5, color: 'rgba(228,224,240,0.4)' },
}
