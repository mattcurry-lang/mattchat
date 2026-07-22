import React from 'react'
import { IconHome, IconPhone, IconStatus, IconUser, IconSparkle, IconPlus } from './Icons'

/**
 * Mobile-style bottom navigation bar.
 * The center "+" (new chat) button has been removed from the nav strip
 * itself — Pulse now occupies that middle slot as a normal tab. The "+"
 * lives on its own now as a floating action button, positioned just
 * above the nav bar (WhatsApp-style compose button), and only shows on
 * the Home/chats tab since that's the only place "new chat" makes sense.
 */
export default function BottomNav({ activeTab, onTabChange, onNewChat, onProfileClick }) {
  return (
    <>
      {activeTab === 'chats' && (
        <button className="fab-new-chat" onClick={onNewChat} title="New chat">
          <IconPlus size={22} />
        </button>
      )}

      <div className="bottom-nav">
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
