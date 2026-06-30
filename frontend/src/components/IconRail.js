import React from 'react'

export default function IconRail({ activeTab, onTabChange, profile, onSignOut }) {
  const initial = profile?.username?.[0]?.toUpperCase() || '?'

  const tabs = [
    { id: 'chats',  icon: '💬', label: 'Chats' },
    { id: 'status', icon: '⭕', label: 'Status' },
    { id: 'calls',  icon: '📞', label: 'Calls' },
  ]

  return (
    <div className="icon-rail">
      <img src="/logo.png" alt="Mattchat" className="icon-rail-logo" />

      {tabs.map(({ id, icon, label }) => (
        <button
          key={id}
          className={`rail-btn ${activeTab === id ? 'active' : ''}`}
          onClick={() => onTabChange(id)}
          title={label}
        >
          {icon}
        </button>
      ))}

      <div className="rail-spacer" />

      <button
        className="rail-btn"
        onClick={onSignOut}
        title="Sign out"
        style={{ fontSize: 18 }}
      >
        ⏏
      </button>

      <div
        className="rail-avatar"
        title={profile?.username || 'Profile'}
      >
        {initial}
      </div>
    </div>
  )
}
