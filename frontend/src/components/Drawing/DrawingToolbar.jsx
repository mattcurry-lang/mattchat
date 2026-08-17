import React, { useState } from 'react'
import {
  IconPencil, IconMarker, IconHighlighter, IconEraser, IconShapes, IconType,
  IconStickyNote, IconImagePlus, IconPointer, IconSmile, IconHourglass, IconCheckSquare,
  IconDna, IconWand, IconGraduationCap ,
  IconUndo, IconRedo, IconTrash, IconDownload, IconMaximize, IconMinimize, IconX,
} from '../Icons'

import ColorPicker from './ColorPicker'
 

const TEMPLATES = [
  { id: 'brainstorm', label: '💡 Brainstorm' },
  { id: 'todo', label: '✅ To-do Board' },
  { id: 'mindmap', label: '🧠 Mind Map' },
]

import ColorPicker from './ColorPicker'

const TEMPLATES = [
  { id: 'brainstorm', label: '💡 Brainstorm' },
  { id: 'todo', label: '✅ To-do Board' },
  { id: 'mindmap', label: '🧠 Mind Map' },
]

const TIMER_PRESETS = [
  { label: '10s', seconds: 10 }, { label: '30s', seconds: 30 },
  { label: '1m', seconds: 60 }, { label: '5m', seconds: 300 },
]
const DRAW_TOOLS = [
  { id: 'pen', label: 'Pen', Icon: IconPencil },
  { id: 'marker', label: 'Marker', Icon: IconMarker },
  { id: 'highlighter', label: 'Highlighter', Icon: IconHighlighter },
  { id: 'eraser', label: 'Eraser', Icon: IconEraser },
]
const SHAPE_TOOLS = [
  { id: 'line', label: 'Line' }, { id: 'arrow', label: 'Arrow' }, { id: 'rect', label: 'Rectangle' },
  { id: 'circle', label: 'Circle' }, { id: 'triangle', label: 'Triangle' },
]
const REACTION_EMOJIS = ['❤️', '😂', '😭', '🔥', '👀', '👍', '😮', '💀', '🎉']

function ToolButton({ active, onClick, title, children }) {
  return (
    <button onClick={onClick} title={title}
      style={{ width: 38, height: 38, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: active ? 'rgba(167,139,250,0.18)' : 'transparent', border: `1px solid ${active ? 'rgba(167,139,250,0.4)' : 'transparent'}`,
        color: active ? '#c4b5fd' : 'rgba(255,255,255,0.6)', cursor: 'pointer', transition: 'all 0.12s', flexShrink: 0 }}
      onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'rgba(255,255,255,0.06)' }}
      onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent' }}>
      {children}
    </button>
  )
}

export default function DrawingToolbar({
  tool, onToolChange, color, onColorChange, size, onSizeChange,
  canUndo, canRedo, onUndo, onRedo, onClear, onExport,
  onAddSticky, onAddImage,
  pointing, onTogglePoint, onPickReaction,
  onStartTimer, onStartVote,
  onAddMindMap, onApplyTemplate, 
  onOpenGamePicker,
  onSaveToChat, saving, saved,
  isFullscreen, onToggleFullscreen, onClose,
}) {
  const [showTemplates, setShowTemplates] = useState(false)
  const [showColorPicker, setShowColorPicker] = useState(false)
  const [showShapes, setShowShapes] = useState(false)
  const [showReactions, setShowReactions] = useState(false)
  const [showTimerMenu, setShowTimerMenu] = useState(false)
  const [showVoteForm, setShowVoteForm] = useState(false)
  const [voteQuestion, setVoteQuestion] = useState('')
  const [voteOptions, setVoteOptions] = useState(['', ''])
  const isShapeActive = SHAPE_TOOLS.some(s => s.id === tool)

  const submitVote = () => {
    const opts = voteOptions.map(o => o.trim()).filter(Boolean)
    if (!voteQuestion.trim() || opts.length < 2) return
    onStartVote(voteQuestion.trim(), opts)
    setVoteQuestion('')
    setVoteOptions(['', ''])
    setShowVoteForm(false)
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '8px 10px', background: '#181825', borderBottom: '1px solid rgba(255,255,255,0.06)', flexWrap: 'wrap', position: 'relative', zIndex: 20 }}>
      {DRAW_TOOLS.map(({ id, label, Icon }) => (
        <ToolButton key={id} active={tool === id} onClick={() => onToolChange(id)} title={label}><Icon size={17} /></ToolButton>
      ))}

      <div style={{ position: 'relative' }}>
        <ToolButton active={isShapeActive} onClick={() => setShowShapes(v => !v)} title="Shapes"><IconShapes size={17} /></ToolButton>
        {showShapes && (
          <div style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, background: '#1e1e2e', border: '1px solid rgba(167,139,250,0.25)', borderRadius: 12, padding: 6, display: 'flex', flexDirection: 'column', gap: 2, zIndex: 30, minWidth: 130, boxShadow: '0 8px 30px rgba(0,0,0,0.4)' }}>
            {SHAPE_TOOLS.map(s => (
              <button key={s.id} onClick={() => { onToolChange(s.id); setShowShapes(false) }}
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 8, background: tool === s.id ? 'rgba(167,139,250,0.15)' : 'none', border: 'none', color: tool === s.id ? '#c4b5fd' : 'rgba(255,255,255,0.75)', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}>
                {s.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <ToolButton active={tool === 'text'} onClick={() => onToolChange('text')} title="Text"><IconType size={17} /></ToolButton>
      {onAddSticky && <ToolButton active={false} onClick={onAddSticky} title="Add sticky note"><IconStickyNote size={17} /></ToolButton>}
      {onAddImage && <ToolButton active={false} onClick={onAddImage} title="Add image"><IconImagePlus size={17} /></ToolButton>}

      <div style={{ width: 1, height: 22, background: 'rgba(255,255,255,0.1)', margin: '0 4px', flexShrink: 0 }} />

      {/* Phase 3: Point mode */}
      {onTogglePoint && (
        <ToolButton active={pointing} onClick={onTogglePoint} title="Point at something"><IconPointer size={17} /></ToolButton>
      )}

      {/* Phase 3: Reaction picker */}
      {onPickReaction && (
        <div style={{ position: 'relative' }}>
          <ToolButton active={showReactions} onClick={() => setShowReactions(v => !v)} title="React"><IconSmile size={17} /></ToolButton>
          {showReactions && (
            <div style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, background: '#1e1e2e', border: '1px solid rgba(167,139,250,0.25)', borderRadius: 14, padding: 6, display: 'flex', gap: 3, zIndex: 30, boxShadow: '0 8px 30px rgba(0,0,0,0.4)' }}>
              {REACTION_EMOJIS.map(e => (
                <button key={e} onClick={() => { onPickReaction(e); setShowReactions(false) }}
                  style={{ width: 30, height: 30, borderRadius: 8, background: 'none', border: 'none', fontSize: 17, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  onMouseEnter={ev => ev.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
                  onMouseLeave={ev => ev.currentTarget.style.background = 'none'}>
                  {e}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
 
      {onOpenGamePicker && (
        <ToolButton active={false} onClick={onOpenGamePicker} title="Play a game">🎮</ToolButton>
      )}
      
      {onStartTimer && (
        <div style={{ position: 'relative' }}>
          <ToolButton active={showTimerMenu} onClick={() => setShowTimerMenu(v => !v)} title="Start timer"><IconHourglass size={17} /></ToolButton>
          {showTimerMenu && (
            <div style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, background: '#1e1e2e', border: '1px solid rgba(167,139,250,0.25)', borderRadius: 12, padding: 6, display: 'flex', flexDirection: 'column', gap: 2, zIndex: 30, minWidth: 100, boxShadow: '0 8px 30px rgba(0,0,0,0.4)' }}>
              {TIMER_PRESETS.map(p => (
                <button key={p.seconds} onClick={() => { onStartTimer(p.seconds); setShowTimerMenu(false) }}
                  style={{ padding: '7px 10px', borderRadius: 8, background: 'none', border: 'none', color: 'rgba(255,255,255,0.8)', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}>
                  {p.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Phase 4a: Vote */}
      {onStartVote && (
        <div style={{ position: 'relative' }}>
          <ToolButton active={showVoteForm} onClick={() => setShowVoteForm(v => !v)} title="Start a vote"><IconCheckSquare size={17} /></ToolButton>
          {showVoteForm && (
            <div style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, background: '#1e1e2e', border: '1px solid rgba(167,139,250,0.25)', borderRadius: 12, padding: 10, display: 'flex', flexDirection: 'column', gap: 6, zIndex: 30, width: 220, boxShadow: '0 8px 30px rgba(0,0,0,0.4)' }}>
              <input value={voteQuestion} onChange={(e) => setVoteQuestion(e.target.value)} placeholder="Question…"
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#fff', fontSize: 12, padding: '6px 8px', outline: 'none' }} />
              {voteOptions.map((opt, i) => (
                <input key={i} value={opt} onChange={(e) => setVoteOptions(prev => prev.map((o, idx) => (idx === i ? e.target.value : o)))} placeholder={`Option ${i + 1}`}
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#fff', fontSize: 12, padding: '6px 8px', outline: 'none' }} />
              ))}
              <div style={{ display: 'flex', gap: 6 }}>
                {voteOptions.length < 4 && (
                  <button onClick={() => setVoteOptions(prev => [...prev, ''])} style={{ flex: 1, background: 'none', border: '1px dashed rgba(255,255,255,0.2)', borderRadius: 8, color: 'rgba(255,255,255,0.6)', fontSize: 11, padding: '5px 0', cursor: 'pointer' }}>+ Option</button>
                )}
                <button onClick={submitVote} style={{ flex: 1, background: 'rgba(167,139,250,0.2)', border: '1px solid rgba(167,139,250,0.35)', borderRadius: 8, color: '#c4b5fd', fontSize: 11, fontWeight: 700, padding: '5px 0', cursor: 'pointer' }}>Start</button>
              </div>
            </div>
          )}
        </div>
      )}
{/* Phase 4b: Mind Map */}
      {onAddMindMap && (
        <ToolButton active={false} onClick={onAddMindMap} title="Add mind map"><IconDna size={17} /></ToolButton>
      )}

      {/* Phase 4b: Templates */}
      {onApplyTemplate && (
        <div style={{ position: 'relative' }}>
          <ToolButton active={showTemplates} onClick={() => setShowTemplates(v => !v)} title="Templates"><IconWand size={17} /></ToolButton>
          {showTemplates && (
            <div style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, background: '#1e1e2e', border: '1px solid rgba(167,139,250,0.25)', borderRadius: 12, padding: 6, display: 'flex', flexDirection: 'column', gap: 2, zIndex: 30, minWidth: 150, boxShadow: '0 8px 30px rgba(0,0,0,0.4)' }}>
              {TEMPLATES.map(t => (
                <button key={t.id} onClick={() => { onApplyTemplate(t.id); setShowTemplates(false) }}
                  style={{ padding: '7px 10px', borderRadius: 8, background: 'none', border: 'none', color: 'rgba(255,255,255,0.8)', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}>
                  {t.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      <div style={{ width: 1, height: 22, background: 'rgba(255,255,255,0.1)', margin: '0 4px', flexShrink: 0 }} />
      <div style={{ position: 'relative' }}>
        <button onClick={() => setShowColorPicker(v => !v)} title="Color" style={{ width: 30, height: 30, borderRadius: '50%', background: color, border: '2px solid rgba(255,255,255,0.25)', cursor: 'pointer', flexShrink: 0 }} />
        {showColorPicker && <ColorPicker color={color} onChange={onColorChange} onClose={() => setShowColorPicker(false)} />}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 90, padding: '0 6px' }}>
        <div style={{ width: Math.max(4, Math.min(size, 20)), height: Math.max(4, Math.min(size, 20)), borderRadius: '50%', background: color, flexShrink: 0 }} />
        <input type="range" min={1} max={40} value={size} onChange={(e) => onSizeChange(Number(e.target.value))} style={{ width: 70, accentColor: '#a78bfa' }} />
      </div>

      <div style={{ width: 1, height: 22, background: 'rgba(255,255,255,0.1)', margin: '0 4px', flexShrink: 0 }} />

      <ToolButton active={false} onClick={onUndo} title="Undo (Ctrl+Z)"><IconUndo size={17} style={{ opacity: canUndo ? 1 : 0.3 }} /></ToolButton>
      <ToolButton active={false} onClick={onRedo} title="Redo (Ctrl+Shift+Z)"><IconRedo size={17} style={{ opacity: canRedo ? 1 : 0.3 }} /></ToolButton>
      <ToolButton active={false} onClick={onClear} title="Clear canvas"><IconTrash size={17} /></ToolButton>

      <div style={{ flex: 1 }} />

      {onSaveToChat && (
        <button onClick={onSaveToChat} disabled={saving} title="Save this drawing to the chat"
          style={{ display: 'flex', alignItems: 'center', gap: 6, height: 34, padding: '0 12px', borderRadius: 20, fontSize: 12, fontWeight: 700, fontFamily: 'inherit', cursor: saving ? 'default' : 'pointer',
            background: saved ? 'rgba(52,211,153,0.15)' : 'rgba(167,139,250,0.15)', border: `1px solid ${saved ? 'rgba(52,211,153,0.35)' : 'rgba(167,139,250,0.3)'}`, color: saved ? '#34d399' : '#c4b5fd', opacity: saving ? 0.7 : 1, flexShrink: 0 }}>
          {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save to Chat'}
        </button>
      )}

      <ToolButton active={false} onClick={onExport} title="Export as PNG"><IconDownload size={17} /></ToolButton>
      <ToolButton active={false} onClick={onToggleFullscreen} title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}>{isFullscreen ? <IconMinimize size={17} /> : <IconMaximize size={17} />}</ToolButton>

      <button onClick={onClose} style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 10, color: '#f87171', width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }} title="Close">
        <IconX size={16} />
      </button>
    </div>
  )
}
