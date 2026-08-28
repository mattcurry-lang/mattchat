import React from 'react'
import { IconHome, IconPhone, IconStatus, IconUser, IconSparkle, IconPlus } from './Icons'

function NavBadge({ count }) {
  if (!count) return null
  return (
    <span className="bnav-badge">
      {count > 99 ? '99+' : count > 9 ? '9+' : count}
    </span>
  )
}

export default function BottomNav({
  activeTab,
  onTabChange,
  onNewChat,
  onProfileClick,
  variant = 'default',
  badges = {}, // { chats?: number, calls?: number, status?: number }
}) {
  const isFloating = variant === 'floating'
  const pulseActive = activeTab === 'pulse'
  const { chats = 0, calls = 0, status = 0 } = badges

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
          <span className="bnav-icon-wrap">
            <IconHome size={19} className="bnav-icon" />
            <NavBadge count={chats} />
          </span>
          <span className="bnav-label">Home</span>
        </button>
        <button
          className={`bnav-btn ${activeTab === 'calls' ? 'active' : ''}`}
          onClick={() => onTabChange('calls')}
          title="Calls"
        >
          <span className="bnav-icon-wrap">
            <IconPhone size={19} className="bnav-icon" />
            <NavBadge count={calls} />
          </span>
          <span className="bnav-label">Calls</span>
        </button>

        {/* ── PULSE — the one visually-distinct nav item ── */}
        <button
          className={`bnav-btn bnav-btn-pulse ${pulseActive ? 'active pulse-active' : 'pulse-inactive'}`}
          onClick={() => onTabChange('pulse')}
          title="Pulse"
        >
          <span className="pulse-icon-wrap">
            <IconSparkle size={21} className="bnav-icon pulse-icon" />
          </span>
          <span className="bnav-label pulse-label">Pulse</span>
        </button>

        <button
          className={`bnav-btn ${activeTab === 'status' ? 'active' : ''}`}
          onClick={() => onTabChange('status')}
          title="Status"
        >
          <span className="bnav-icon-wrap">
            <IconStatus size={19} className="bnav-icon" />
            <NavBadge count={status} />
          </span>
          <span className="bnav-label">Status</span>
        </button>
        <button className="bnav-btn" onClick={onProfileClick} title="Profile">
          <IconUser size={19} className="bnav-icon" />
          <span className="bnav-label">Profile</span>
        </button>
      </div>

      {/* Scoped styling for the Pulse nav item + badges */}
      <style>{`
        .bnav-icon-wrap {
          position: relative;
          display: inline-flex;
        }
        .bnav-badge {
          position: absolute;
          top: -6px;
          right: -9px;
          min-width: 16px;
          height: 16px;
          padding: 0 4px;
          border-radius: 999px;
          background: #ef4444;
          color: #fff;
          font-size: 10px;
          font-weight: 800;
          line-height: 16px;
          text-align: center;
          box-shadow: 0 0 0 2px var(--bg-surface-1, #14141f);
        }

        .bnav-btn-pulse {
          position: relative;
          border-radius: 16px;
          transition: transform 0.25s cubic-bezier(0.34,1.56,0.64,1),
                      background 0.3s ease, box-shadow 0.3s ease;
        }

        /* Glassmorphic pill container, purple/indigo family to match
           Mattchat's existing accent (#667eea → #764ba2 / #a78bfa). */
        .pulse-inactive {
          background: linear-gradient(135deg, rgba(102,126,234,0.10), rgba(118,75,162,0.10));
          border: 1px solid rgba(167,139,250,0.28);
          box-shadow: 0 0 10px rgba(124,58,237,0.12);
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
        }
        .pulse-inactive .pulse-icon {
          color: #8b7ff0;
          filter: drop-shadow(0 0 4px rgba(139,127,240,0.45));
        }
        .pulse-inactive .pulse-label {
          color: #9d8ff5;
          font-weight: 700;
        }

        .pulse-active {
          background: linear-gradient(135deg, rgba(102,126,234,0.28), rgba(167,139,250,0.28));
          border: 1px solid rgba(196,181,253,0.6);
          box-shadow:
            0 0 18px rgba(167,139,250,0.55),
            0 0 36px rgba(118,75,162,0.30),
            0 4px 14px rgba(0,0,0,0.18);
          backdrop-filter: blur(14px);
          -webkit-backdrop-filter: blur(14px);
          transform: translateY(-3px);
          animation: pulseBreathe 2.8s ease-in-out infinite;
        }
        .pulse-active .pulse-icon-wrap {
          position: relative;
        }
        .pulse-active .pulse-icon-wrap::before {
          content: '';
          position: absolute;
          inset: -7px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(196,181,253,0.55), rgba(167,139,250,0) 70%);
          animation: pulseGlowRing 2.8s ease-in-out infinite;
          z-index: 0;
        }
        .pulse-active .pulse-icon {
          position: relative;
          z-index: 1;
          color: #f3f0ff;
          filter: drop-shadow(0 0 7px rgba(196,181,253,0.9)) drop-shadow(0 0 14px rgba(139,92,246,0.55));
        }
        .pulse-active .pulse-label {
          color: #f3f0ff;
          font-weight: 800;
          text-shadow: 0 0 8px rgba(167,139,250,0.6);
        }

        @keyframes pulseBreathe {
          0%, 100% {
            box-shadow:
              0 0 18px rgba(167,139,250,0.55),
              0 0 36px rgba(118,75,162,0.30),
              0 4px 14px rgba(0,0,0,0.18);
          }
          50% {
            box-shadow:
              0 0 26px rgba(167,139,250,0.75),
              0 0 46px rgba(118,75,162,0.42),
              0 4px 14px rgba(0,0,0,0.18);
          }
        }

        @keyframes pulseGlowRing {
          0%, 100% { opacity: 0.55; transform: scale(1); }
          50% { opacity: 0.9; transform: scale(1.12); }
        }

        /* Light mode: keep Pulse from washing out against a light
           background — deepen the border/text so contrast holds up. */
        :root[data-theme="light"] .pulse-inactive,
        .light .pulse-inactive {
          background: linear-gradient(135deg, rgba(102,126,234,0.14), rgba(118,75,162,0.14));
          border: 1px solid rgba(124,58,237,0.35);
          box-shadow: 0 0 10px rgba(124,58,237,0.18);
        }
        :root[data-theme="light"] .pulse-inactive .pulse-icon,
        .light .pulse-inactive .pulse-icon {
          color: #6d4fd6;
          filter: drop-shadow(0 0 4px rgba(109,79,214,0.35));
        }
        :root[data-theme="light"] .pulse-inactive .pulse-label,
        .light .pulse-inactive .pulse-label {
          color: #6d4fd6;
        }
        :root[data-theme="light"] .pulse-active,
        .light .pulse-active {
          background: linear-gradient(135deg, rgba(102,126,234,0.22), rgba(139,92,246,0.24));
          border: 1px solid rgba(109,79,214,0.55);
        }
        :root[data-theme="light"] .pulse-active .pulse-icon,
        .light .pulse-active .pulse-icon {
          color: #4c2fb0;
          filter: drop-shadow(0 0 6px rgba(139,92,246,0.6));
        }
        :root[data-theme="light"] .pulse-active .pulse-label,
        .light .pulse-active .pulse-label {
          color: #4c2fb0;
          text-shadow: none;
        }

        @media (max-width: 480px) {
          .bnav-btn-pulse { border-radius: 13px; }
          .pulse-active { transform: translateY(-2px); }
          .pulse-active .pulse-icon-wrap::before { inset: -5px; }
        }

        @media (prefers-reduced-motion: reduce) {
          .pulse-active { animation: none; }
          .pulse-active .pulse-icon-wrap::before { animation: none; }
        }
      `}</style>
    </>
  )
}
