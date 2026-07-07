import React from 'react'
import Avatar from './Avatar'
import { IconPhone, IconVideo } from './Icons'

export default function NewCallModal({ conversations, userId, onCall, onClose }) {
  // Group calls aren't wired up yet, so only 1:1 conversations get
  // call buttons here for now — same limitation as CallButtons in
  // the chat header.
  const callable = conversations.filter(c => !c.is_group)

  const getName = (c) => {
    const other = c.conversation_members?.find(m => m.user_id !== userId)
    return other?.profiles?.username || other?.profiles?.email || 'Unknown'
  }

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={e => e.stopPropagation()}>
        <div style={styles.header}>
          <span style={styles.title}>New call</span>
          <button style={styles.closeBtn} onClick={onClose}>✕</button>
        </div>

        <div style={styles.list}>
          {callable.length === 0 && (
            <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
              Start a conversation first, then you can call them from here.
            </div>
          )}
          {callable.map(c => (
            <div key={c.id} style={styles.row}>
              <Avatar name={getName(c)} size={42} />
              <div style={{ flex: 1, minWidth: 0, marginLeft: 10 }}>
                <div style={styles.name}>{getName(c)}</div>
              </div>
              <button style={styles.callBtn} onClick={() => onCall(c, 'audio')} title="Voice call">
                <IconPhone size={17} />
              </button>
              <button style={styles.callBtn} onClick={() => onCall(c, 'video')} title="Video call">
                <IconVideo size={17} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

const styles = {
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 500, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' },
  modal: { width: '100%', maxWidth: 420, background: 'var(--bg-surface, #17171f)', borderRadius: '20px 20px 0 0', maxHeight: '70vh', display: 'flex', flexDirection: 'column', animation: 'slideUp 0.25s ease' },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 18px', borderBottom: '1px solid var(--border)' },
  title: { fontSize: 15, fontWeight: 700, color: '#fff' },
  closeBtn: { background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 16, cursor: 'pointer' },
  list: { overflowY: 'auto', padding: '6px 0' },
  row: { display: 'flex', alignItems: 'center', padding: '10px 16px' },
  name: { fontSize: 14, fontWeight: 600, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  callBtn: { width: 38, height: 38, borderRadius: '50%', background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.3)', color: '#4ade80', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', marginLeft: 8 },
}
