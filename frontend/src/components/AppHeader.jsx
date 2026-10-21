import React from 'react'
import { IconMoreVertical } from './Icons'
import QuickMusicAccess from './Pulse/Music/QuickMusicAccess'
import { useOnlineStatus } from '../hooks/useOnlineStatus'

export default function AppHeader({ logoProps = {}, menuBtnRef, menuOpen, onToggleMenu, curryListening, menuNode, briefNode }) {
  const online = useOnlineStatus()

  return (
    <div className="mc-hdr">
      <div className="mc-brand">
        <span className="mc-logo" {...logoProps}>
          <span className="mc-logo-ring" aria-hidden />
          <img src="/logo.png" alt="Mattchat" draggable={false} />
        </span>
        <div className="mc-wordmark" {...logoProps}>
          <span className="mc-name">Mattchat</span>
          <span className={`mc-status ${online ? 'on' : 'off'}`} role="status">
            <i aria-hidden />{online ? 'Online' : 'Offline'}
          </span>
        </div>
      </div>

      <div className="mc-actions" role="toolbar" aria-label="Quick actions">
        <QuickMusicAccess bare />
        {briefNode}
        <div style={{ position: 'relative' }}>
          <button
            ref={menuBtnRef}
            className={`mc-act${menuOpen || curryListening ? ' is-active' : ''}${curryListening ? ' is-listening' : ''}`}
            onClick={onToggleMenu}
            aria-label="More options"
            aria-haspopup="menu"
            aria-expanded={!!menuOpen}
            title={curryListening ? 'Hey Curry is listening' : 'More'}
          >
            <IconMoreVertical size={17} />
          </button>
          {menuNode}
        </div>
      </div>
    </div>
  )
}

if (typeof document !== 'undefined' && !document.getElementById('mc-header-styles')) {
  const el = document.createElement('style')
  el.id = 'mc-header-styles'
  el.textContent = `
    @property --mc-ang { syntax: '<angle>'; inherits: false; initial-value: 0deg; }
    @keyframes mc-orbit { to { --mc-ang: 360deg; } }
    @keyframes mc-dot { 0%,100% { opacity:.55; transform:scale(1); } 50% { opacity:1; transform:scale(1.35); } }
    @keyframes mc-ring { from { opacity:.9; transform:scale(.9); } to { opacity:0; transform:scale(1.4); } }

    .mc-hdr { position:relative; z-index:2; display:flex; align-items:center; justify-content:space-between; gap:12px; margin-bottom:14px; }
    .mc-brand { display:flex; align-items:center; gap:11px; min-width:0; }

    .mc-logo { position:relative; width:40px; height:40px; flex-shrink:0; display:grid; place-items:center; border-radius:50%; cursor:default; -webkit-tap-highlight-color:transparent; }
    .mc-logo-ring {
      position:absolute; inset:0; border-radius:50%; padding:2px;
      background:conic-gradient(from var(--mc-ang), #6c63ff, #f093fb, #5eead4, #a78bfa, #6c63ff);
      -webkit-mask:linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
      -webkit-mask-composite:xor; mask-composite:exclude;
      animation:mc-orbit 7s linear infinite; filter:drop-shadow(0 0 7px rgba(167,139,250,.6));
    }
    .mc-logo img { width:26px; height:26px; border-radius:8px; object-fit:contain; user-select:none; }

    .mc-wordmark { display:flex; flex-direction:column; line-height:1.1; min-width:0; }
    .mc-name {
      font-family:var(--font-display, inherit); font-weight:800; font-size:20px; letter-spacing:-.45px;
      background:linear-gradient(100deg, var(--dark-text, #fff) 35%, #c4b5fd 78%, #f0abfc);
      -webkit-background-clip:text; background-clip:text; color:transparent;
    }
    .mc-status { display:flex; align-items:center; gap:5px; margin-top:2px; font-size:10.5px; font-weight:700; letter-spacing:.3px; color:var(--dark-muted, rgba(255,255,255,.6)); }
    .mc-status i { width:6px; height:6px; border-radius:50%; background:#4ade80; box-shadow:0 0 8px #4ade80; animation:mc-dot 2.4s ease-in-out infinite; }
    .mc-status.off i { background:#fbbf24; box-shadow:0 0 8px #fbbf24; animation:none; }

    /* one floating glass pill; 36px targets with 2px gaps (WCAG 2.2 target size) */
    .mc-actions {
      --mc-cluster-bg:#1c1830;
      display:flex; align-items:center; gap:2px; padding:4px; border-radius:999px; flex-shrink:0;
      background:var(--chip-bg, rgba(255,255,255,.07)); border:1px solid rgba(255,255,255,.13);
      -webkit-backdrop-filter:blur(16px) saturate(170%); backdrop-filter:blur(16px) saturate(170%);
      box-shadow:inset 0 1px 0 rgba(255,255,255,.2), 0 8px 22px rgba(0,0,0,.22);
    }
    .mc-act {
      width:36px; height:36px; border-radius:50%; border:none; background:transparent; color:var(--dark-text, #fff);
      display:grid; place-items:center; cursor:pointer; position:relative; padding:0;
      transition:background .18s ease, transform .12s ease, color .18s ease;
    }
    .mc-act:hover { background:rgba(255,255,255,.12); }
    .mc-act:active { transform:scale(.92); }
    .mc-act:focus-visible { outline:2px solid #a78bfa; outline-offset:1px; }
    .mc-act.is-active { background:rgba(167,139,250,.22); color:#c4b5fd; }
    .mc-act.is-listening::after { content:''; position:absolute; inset:-3px; border-radius:50%; border:2px solid rgba(167,139,250,.7); animation:mc-ring 1.6s ease-out infinite; }

    [data-theme="light"] .mc-actions { --mc-cluster-bg:#fff; background:rgba(255,255,255,.72); border-color:rgba(108,99,255,.2); box-shadow:inset 0 1px 0 #fff, 0 8px 22px rgba(108,99,255,.14); }
    [data-theme="light"] .mc-act:hover { background:rgba(108,99,255,.1); }
    [data-theme="light"] .mc-act.is-active { color:#6c63ff; }

    @media (max-width:380px) { .mc-name { font-size:17px; } .mc-status { display:none; } .mc-logo { width:36px; height:36px; } }
    @media (prefers-reduced-motion: reduce) {
      .mc-logo-ring, .mc-status i, .mc-act.is-listening::after { animation:none; }
    }
  `
  document.head.appendChild(el)
}
