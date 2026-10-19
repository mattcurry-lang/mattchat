import React from 'react'
import Avatar from '../components/Avatar'
import { heatLabel } from './warmth'
import './afterglow.css'

/**
 * The single ring. It replaces the unread badge, the story ring, the note
 * indicator and the online dot with ONE glowing edge:
 *   glow strength  = how warm the conversation is
 *   soft pulse     = something unread
 *   slow comet arc = they posted a note
 *   small dot      = online right now
 */
export default function GlowAvatar({ name, photoUrl, size = 48, hue = 258, warmth = 0.1, unread = 0, online = false, spark = false, inner = null, children }) {
  const outer = size + 10
  return (
    <div
      className={`ag-ring${unread > 0 ? ' ag-unread' : ''}${spark ? ' ag-spark' : ''}`}
      data-heat={heatLabel(warmth)}
      style={{ '--ag-h': hue, '--ag-w': warmth, width: outer, height: outer }}
    >
      <span className="ag-ring-arc" aria-hidden="true" />
      <div className="ag-ring-inner" style={{ width: size, height: size }}>
        {inner ?? <Avatar name={name} size={size} online={false} photoUrl={photoUrl} />}
      </div>
      {online && <span className="ag-dot" aria-label="Online" />}
      {children}
    </div>
  )
}
