import React, { useState } from 'react'
import { IconEye, IconEyeOff, IconLock, IconTrash, IconCopy, IconChevronUp, IconChevronDown } from '../Icons'

export default function LayersPanel({
  layers, activeLayerId, onSelect, onToggleVisible, onToggleLocked,
  onRename, onOpacityChange, onReorder, onDuplicate, onDelete, onCreate,
  onClearActive, onClose,
}) {
  const [editingId, setEditingId] = useState(null)
  const [draftName, setDraftName] = useState('')
  const sorted = [...layers].sort((a, b) => b.position - a.position) // topmost first

  const startEdit = (l) => { setEditingId(l.id); setDraftName(l.name) }
  const commitEdit = () => {
    if (editingId && draftName.trim()) onRename(editingId, draftName.trim())
    setEditingId(null)
  }

  return (
    <div style={{
      position: 'absolute', top: 12, right: 12, zIndex: 18, width: 220,
      background: 'rgba(15,15,26,0.92)', border: '1px solid rgba(255,255,255,0.12)',
      borderRadius: 14, padding: 8, boxShadow: '0 8px 30px rgba(0,0,0,0.4)',
      display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 340,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 11.5, fontWeight: 800, color: 'rgba(255,255,255,0.7)' }}>Layers</span>
        <div style={{ display: 'flex', gap: 4 }}>
          <button onClick={onCreate} title="Add layer"
            style={{ background: 'rgba(167,139,250,0.15)', border: '1px solid rgba(167,139,250,0.3)', borderRadius: 8, color: '#c4b5fd', fontSize: 13, fontWeight: 800, width: 22, height: 22, cursor: 'pointer', lineHeight: 1 }}>+</button>
          <button onClick={onClose} title="Close"
            style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', fontSize: 14, cursor: 'pointer', lineHeight: 1, padding: 0 }}>✕</button>
        </div>
      </div>

      <div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
        {sorted.map((l, i) => {
          const active = l.id === activeLayerId
          return (
            <div key={l.id} onClick={() => onSelect(l.id)}
              style={{
                display: 'flex', flexDirection: 'column', gap: 4, padding: '6px 8px', borderRadius: 10, cursor: 'pointer',
                background: active ? 'rgba(167,139,250,0.15)' : 'rgba(255,255,255,0.04)',
                border: `1px solid ${active ? 'rgba(167,139,250,0.4)' : 'transparent'}`,
              }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <button onClick={(e) => { e.stopPropagation(); onToggleVisible(l.id) }} title={l.visible ? 'Hide' : 'Show'}
                  style={{ background: 'none', border: 'none', color: l.visible ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.3)', cursor: 'pointer', padding: 0, display: 'flex' }}>
                  {l.visible ? <IconEye size={14} /> : <IconEyeOff size={14} />}
                </button>
                <button onClick={(e) => { e.stopPropagation(); onToggleLocked(l.id) }} title={l.locked ? 'Unlock' : 'Lock'}
                  style={{ background: 'none', border: 'none', color: l.locked ? '#fbbf24' : 'rgba(255,255,255,0.25)', cursor: 'pointer', padding: 0, display: 'flex' }}>
                  <IconLock size={13} />
                </button>
                {editingId === l.id ? (
                  <input autoFocus value={draftName} onChange={(e) => setDraftName(e.target.value)}
                    onBlur={commitEdit} onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') setEditingId(null) }}
                    style={{ flex: 1, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(167,139,250,0.4)', borderRadius: 6, color: '#fff', fontSize: 11.5, padding: '2px 5px', outline: 'none', minWidth: 0 }} />
                ) : (
                  <span onDoubleClick={(e) => { e.stopPropagation(); startEdit(l) }}
                    style={{ flex: 1, fontSize: 11.5, fontWeight: 700, color: 'rgba(255,255,255,0.9)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {l.name}
                  </span>
                )}
                <button onClick={(e) => { e.stopPropagation(); onReorder(l.id, 'up') }} disabled={i === 0} title="Move up"
                  style={{ background: 'none', border: 'none', color: i === 0 ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.5)', cursor: i === 0 ? 'default' : 'pointer', padding: 0, display: 'flex' }}>
                  <IconChevronUp size={12} />
                </button>
                <button onClick={(e) => { e.stopPropagation(); onReorder(l.id, 'down') }} disabled={i === sorted.length - 1} title="Move down"
                  style={{ background: 'none', border: 'none', color: i === sorted.length - 1 ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.5)', cursor: i === sorted.length - 1 ? 'default' : 'pointer', padding: 0, display: 'flex' }}>
                  <IconChevronDown size={12} />
                </button>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input type="range" min={0} max={100} value={Math.round((l.opacity ?? 1) * 100)}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => onOpacityChange(l.id, Number(e.target.value) / 100)}
                  style={{ flex: 1, accentColor: '#a78bfa', height: 14 }} />
                <button onClick={(e) => { e.stopPropagation(); onDuplicate(l.id) }} title="Duplicate layer"
                  style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', padding: 0, display: 'flex' }}>
                  <IconCopy size={12} />
                </button>
                {sorted.length > 1 && (
                  <button onClick={(e) => { e.stopPropagation(); onDelete(l.id) }} title="Delete layer"
                    style={{ background: 'none', border: 'none', color: 'rgba(239,68,68,0.7)', cursor: 'pointer', padding: 0, display: 'flex' }}>
                    <IconTrash size={12} />
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <button onClick={onClearActive}
        style={{ marginTop: 2, background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', fontSize: 10.5, cursor: 'pointer', textDecoration: 'underline', alignSelf: 'flex-start' }}>
        Clear active layer
      </button>
    </div>
  )
}
