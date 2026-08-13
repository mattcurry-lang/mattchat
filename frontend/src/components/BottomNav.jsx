import React from 'react'
import { IconHome, IconPhone, IconStatus, IconUser, IconSparkle, IconPlus } from './Icons'
/**
 * Mobile-style bottom navigation bar.
 * The center "+" (new chat) button has been removed from the nav strip
 * itself — Pulse now occupies that middle slot as a normal tab. The "+"
 * lives on its own now as a floating action button, positioned just
 * above the nav bar (WhatsApp-style compose button), and only shows on
 * the Home/chats tab since that's the only place "new chat" makes sense.
 *
 * variant="default" — the original centered pill (used in the main sidebar).
 * variant="floating" — a compact bottom-left cluster (used inside Shorts,
 * so navigation stays reachable without a full-width bar sitting over the
 * video). Hidden on narrow/mobile widths — see .bottom-nav-floating CSS —
 * since there's no room for a floating cluster on a small screen, and the
 * native scroll/swipe navigation already covers that case there.
 */
export default function BottomNav({ activeTab, onTabChange, onNewChat, onProfileClick, variant = 'default' }) {
  const isFloating = variant === 'floating'
  return (
    <>
      {activeTab === 'chats' && !isFloating && (
        <button className="fab-new-chat" onClick={onNewChat} title="New chat">
          <IconPlus size={22} />
        </button>
      )}
      <div className={isFloating ? 'bottom-nav bottom-nav-floating' : 'bottom-nav'}>
        <button
          className={`bnav-btn ${activeTab === 'chats' ? 'active' : ''}`}
          onClick={() => onTabChange('chats')}
          title="Chats"
        >
          <IconHome size={19} className="bnav-icon" />
          <span className="bnav-label">Home</span>
        </button>
        <button
          className={`bnav-btn ${activeTab === 'calls' ? 'active' : ''}`}
          onClick={() => onTabChange('calls')}
          title="Calls"
        >
          <IconPhone size={19} className="bnav-icon" />
          <span className="bnav-label">Calls</span>
        </button>
        <button
          className={`bnav-btn ${activeTab === 'pulse' ? 'active' : ''}`}
          onClick={() => onTabChange('pulse')}
          title="Pulse"
        >
          <IconSparkle size={19} className="bnav-icon" />
          <span className="bnav-label">Pulse</span>
        </button>
        <button
          className={`bnav-btn ${activeTab === 'status' ? 'active' : ''}`}
          onClick={() => onTabChange('status')}
          title="Status"
        >
          <IconStatus size={19} className="bnav-icon" />
          <span className="bnav-label">Status</span>
        </button>
        <button className="bnav-btn" onClick={onProfileClick} title="Profile">
          <IconUser size={19} className="bnav-icon" />
          <span className="bnav-label">Profile</span>
        </button>
      </div>
    </>
  )
}
