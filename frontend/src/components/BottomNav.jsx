import React from 'react'
import { IconHome, IconPhone, IconCamera, IconUser } from './Icons'

/**
 * Mobile-style bottom navigation bar — replaces the old desktop IconRail
 * now that the app uses a single layout at every screen size.
 * Only rendered on the list/browse screens; hidden while a conversation
 * is open (the chat view uses its own back button instead).
 */
export default function BottomNav({ activeTab, onTabChange, onNewChat, onProfileClick }) {
  return (
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

      <button className="bnav-plus" onClick={onNewChat} title="New chat">
        <span>＋</span>
      </button>

      <button
        className={`bnav-btn ${activeTab === 'status' ? 'active' : ''}`}
        onClick={() => onTabChange('status')}
        title="Status"
      >
        <IconCamera size={19} className="bnav-icon" />
        <span className="bnav-label">Status</span>
      </button>

      <button className="bnav-btn" onClick={onProfileClick} title="Profile">
        <IconUser size={19} className="bnav-icon" />
        <span className="bnav-label">Profile</span>
      </button>
    </div>
  )
}
