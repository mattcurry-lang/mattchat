import React, { useRef, useState } from 'react'
import GlowAvatar from './GlowAvatar'
import RowSheet from './RowSheet'
import { convoHue, warmthOf, isNoteActive, freshNote } from './warmth'
import { useMinuteTick } from './useAfterglow'
import { IconStar, IconTrash } from '../components/Icons'
import './afterglow.css'

/**
 * One row in the chat list. All app-specific pieces (the preview JSX, the
 * verified tick, the status emoji) are passed in, so this file knows nothing
 * about ChatPage and can be tested on its own.
 */
export default function ConversationRow({
  id, name, photoUrl, active = false, unread = 0, online = false, typing = false,
  lastActivityAt, timeLabel, extras, preview, previewKey, isClose = false,
  nameSuffix, avatarExtras, onOpen, onDelete, onToggleClose,
}) {
  useMinuteTick() // re-render each minute so the glow cools live
  const now = Date.now()
  const hue = convoHue(id || name)
  const warmth = warmthOf({ lastActivityAt, unread, online, typing, now })
  const spark = isNoteActive(extras, now)
  const note = unread === 0 && !typing ? freshNote(extras, lastActivityAt, now) : null

  // long-press on touch toggles "Close" (hover star does the same on desktop)
  const press = useRef({ timer: null, fired: false })
  const [flash, setFlash] = useState(false)
  const toggle = () => {
    onToggleClose?.()
    setFlash(true)
    setTimeout(() => setFlash(false), 1400)
  }
  const [sheetOpen, setSheetOpen] = useState(false)
  const startPress = (e) => {
    if (e.pointerType === 'mouse') return
    press.current.fired = false
    press.current.timer = setTimeout(() => {
      press.current.fired = true
      try { navigator.vibrate?.(12) } catch {}
      setSheetOpen(true)
    }, 550)
  }
  const endPress = () => clearTimeout(press.current.timer)

  return (
    <div
      className={`contact ag-row${active ? ' active' : ''}${unread > 0 ? ' ag-has-unread' : ''}`}
      style={{ '--ag-h': hue, '--ag-w': warmth }}
      role="button" tabIndex={0}
      onClick={() => {
        if (press.current.fired) { press.current.fired = false; return }
        onOpen?.()
      }}
      onKeyDown={(e) => { if (e.key === 'Enter') onOpen?.() }}
      onPointerDown={startPress} onPointerUp={endPress} onPointerLeave={endPress} onPointerCancel={endPress}
      onContextMenu={(e) => { e.preventDefault(); setSheetOpen(true) }}
    >
      <GlowAvatar name={name} photoUrl={photoUrl} hue={hue} warmth={warmth} unread={unread} online={online} spark={spark}>
        {avatarExtras}
      </GlowAvatar>

      <div className="contact-info">
        <div className={`contact-name ag-name${unread > 0 ? ' unread' : ''}`}>
          <span className="ag-name-text">{name}</span>
          {nameSuffix}
          {isClose && <IconStar size={11} filled className="ag-close-mark" aria-label="Close" />}
        </div>
        <div className="contact-preview-swap" key={previewKey}>
          {note ? (
            <div className="contact-preview ag-note"><span className="ag-note-tag">note</span>{note}</div>
          ) : preview}
        </div>
      </div>

      <div className="ag-side">
        <div className={`ag-time${warmth > 0.6 ? ' warm' : ''}${flash ? ' flash' : ''}`}>
          {flash ? (isClose ? 'Close ✦' : 'Removed') : timeLabel}
        </div>
        <div className="ag-actions">
          <button className={`ag-act${isClose ? ' on' : ''}`} title={isClose ? 'Remove from Close' : 'Add to Close'}
            onClick={(e) => { e.stopPropagation(); toggle() }}>
            <IconStar size={13} filled={isClose} />
          </button>
          <button className="ag-act" title="Delete chat" onClick={(e) => { e.stopPropagation(); onDelete?.() }}>
            <IconTrash size={13} />
          </button>
        </div>
      </div>
      <RowSheet open={sheetOpen} name={name} isClose={isClose} onClose={() => setSheetOpen(false)} onToggleClose={toggle} onDelete={onDelete} />
    </div>
  )
}
