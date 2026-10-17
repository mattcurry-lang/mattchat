import React from 'react'
import { motion } from 'framer-motion'
import GlowAvatar from './GlowAvatar'
import { convoHue } from './warmth'
import './afterglow-home.css'

const rise = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 320, damping: 30 } },
}

function greetingFor(date = new Date()) {
  const h = date.getHours()
  return h < 5 ? 'Still up' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'
}

function describe(item) {
  if (item.typing) return 'is typing…'
  if (item.unread > 1) return `${item.unread} new messages`
  if (item.unread === 1) return '1 new message'
  if (item.online) return 'Online now'
  return item.timeLabel ? `Last message · ${item.timeLabel}` : 'Say hello'
}

/**
 * The desktop home (right pane when no chat is open). It replaces the generic
 * "Select a conversation" with the one thing you most likely want — the
 * warmest conversation — plus the few others that are alive, and the same
 * shortcuts that used to float around the screen.
 *
 * `chats` arrives ranked warmest-first. All behaviour is passed in.
 */
export default function ResumeHome({ chats = [], userName, tiles = [], onNewChat }) {
  const top = chats[0]
  const alive = chats.slice(1).filter((x) => x.warmth >= 0.25).slice(0, 6)
  const hue = top ? convoHue(top.id) : 258
  const sub = !top
    ? 'Start your first conversation.'
    : top.unread > 0 ? 'Something is waiting for you.'
    : top.typing ? 'Someone is typing to you.'
    : 'Pick up where you left off.'

  return (
    <div className="ag-home" style={{ '--ag-h': hue }}>
      <div className="ag-home-wash" aria-hidden="true" />
      <motion.div className="ag-home-inner" initial="hidden" animate="show" transition={{ staggerChildren: 0.07 }}>
        <motion.div variants={rise} className="ag-home-greet">
          <div className="ag-home-hello">{greetingFor()}{userName ? <>, <b>{userName}</b></> : null}</div>
          <div className="ag-home-sub">{sub}</div>
        </motion.div>

        {top ? (
          <motion.div
            variants={rise} className="ag-resume" role="button" tabIndex={0}
            onClick={top.open} onKeyDown={(e) => { if (e.key === 'Enter') top.open() }}
          >
            <GlowAvatar name={top.name} photoUrl={top.photoUrl} size={68} hue={hue} warmth={top.warmth} unread={top.unread} online={top.online} spark={false} />
            <div className="ag-resume-body">
              <div className="ag-resume-name">{top.name}</div>
              <div className={`ag-resume-status${top.unread > 0 || top.typing ? ' hot' : ''}`}>{describe(top)}</div>
              {top.preview && <div className="ag-resume-preview">{top.preview}</div>}
            </div>
            <span className="ag-resume-go">Continue<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg></span>
          </motion.div>
        ) : (
          <motion.button variants={rise} className="ag-start" onClick={onNewChat}>Start a conversation</motion.button>
        )}

        {alive.length > 0 && (
          <motion.div variants={rise} className="ag-alive">
            <div className="ag-section-label">Also alive</div>
            <div className="ag-alive-row">
              {alive.map((x) => (
                <button key={x.id} className="ag-alive-item" onClick={x.open} title={x.name}>
                  <GlowAvatar name={x.name} photoUrl={x.photoUrl} size={44} hue={convoHue(x.id)} warmth={x.warmth} unread={x.unread} online={x.online} />
                  <span className="ag-alive-name">{x.name.split(' ')[0]}</span>
                </button>
              ))}
            </div>
          </motion.div>
        )}

        <motion.div variants={rise} className="ag-tiles">
          {tiles.map((t) => (
            <button key={t.id} className="ag-home-tile" onClick={t.onClick}>
              <span className="ag-home-tile-ico">{t.icon}{t.badge && <i className="ag-home-tile-badge" />}</span>
              <span className="ag-home-tile-label">{t.label}</span>
            </button>
          ))}
        </motion.div>
      </motion.div>
    </div>
  )
}
