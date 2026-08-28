import React, { useEffect, useState } from 'react'

// Small, ambient notification — deliberately NOT the full invite card
// used inside the chat (WatchTogetherInvite.jsx). This is a passive
// "someone wants to watch with you" nudge that can appear from
// anywhere in the app; tapping it takes you to the real invite.
export default function GlobalWatchInviteBanner({ invite, inviterName, onOpen, onDismiss }) {
  const [mounted, setMounted] = useState(false)

  // Two-frame mount so the CSS transition actually plays on entry
  // instead of snapping straight to its resting position.
  useEffect(() => {
    const raf = requestAnimationFrame(() => setMounted(true))
    return () => cancelAnimationFrame(raf)
  }, [])

  if (!invite) return null

  const videoLabel = invite.videoTitle ? `"${invite.videoTitle}"` : 'a video'

  return (
    <div
      onClick={onOpen}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter') onOpen?.() }}
      className={`gwi-banner ${mounted ? 'gwi-in' : ''}`}
      style={{
        position: 'fixed', top: 14, right: 14, zIndex: 720,
        width: 280, cursor: 'pointer',
      }}
    >
      <div className="gwi-glow" />
      <div className="gwi-card">
        <div className="gwi-thumb-wrap">
          {invite.videoThumbnailUrl ? (
            <img src={invite.videoThumbnailUrl} alt="" className="gwi-thumb" />
          ) : (
            <div className="gwi-thumb gwi-thumb-fallback">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>
          )}
          <span className="gwi-pulse-dot" />
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="gwi-title">
            <span className="gwi-name">{inviterName}</span> wants to watch
          </div>
          <div className="gwi-sub">{videoLabel}</div>
        </div>

        <button
          onClick={(e) => { e.stopPropagation(); onDismiss?.() }}
          className="gwi-close"
          title="Dismiss"
          aria-label="Dismiss"
        >
          <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>

      <style>{`
        .gwi-banner {
          opacity: 0;
          transform: translateY(-26px) scale(0.96);
          transition: opacity 0.9s cubic-bezier(0.16,1,0.3,1), transform 0.9s cubic-bezier(0.16,1,0.3,1);
        }
        .gwi-banner.gwi-in {
          opacity: 1;
          transform: translateY(0) scale(1);
        }

        .gwi-glow {
          position: absolute;
          inset: -1px;
          border-radius: 17px;
          padding: 1px;
          background: linear-gradient(135deg, rgba(167,139,250,0.55), rgba(102,126,234,0.15) 45%, rgba(52,211,153,0.35));
          -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
          -webkit-mask-composite: xor;
          mask-composite: exclude;
          animation: gwiRingPulse 3.2s ease-in-out infinite;
          pointer-events: none;
        }
        @keyframes gwiRingPulse {
          0%, 100% { opacity: 0.55; }
          50% { opacity: 1; }
        }

        .gwi-card {
          position: relative;
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 10px 10px 10px;
          border-radius: 16px;
          background: rgba(22,22,34,0.55);
          backdrop-filter: blur(18px) saturate(160%);
          -webkit-backdrop-filter: blur(18px) saturate(160%);
          border: 1px solid rgba(255,255,255,0.08);
          box-shadow: 0 8px 32px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.06);
        }

        .gwi-thumb-wrap { position: relative; flex-shrink: 0; }
        .gwi-thumb {
          width: 40px; height: 40px; border-radius: 10px; object-fit: cover; display: block;
        }
        .gwi-thumb-fallback {
          background: linear-gradient(135deg, rgba(102,126,234,0.35), rgba(118,75,162,0.35));
          display: flex; align-items: center; justify-content: center; color: #e5e7eb;
        }
        .gwi-pulse-dot {
          position: absolute; top: -3px; right: -3px;
          width: 9px; height: 9px; border-radius: 50%;
          background: #34d399;
          box-shadow: 0 0 0 2px rgba(22,22,34,0.9);
        }
        .gwi-pulse-dot::after {
          content: ''; position: absolute; inset: 0; border-radius: 50%;
          background: #34d399; animation: gwiDotPing 1.8s cubic-bezier(0,0,0.2,1) infinite;
        }
        @keyframes gwiDotPing {
          0% { transform: scale(1); opacity: 0.7; }
          75%, 100% { transform: scale(2.4); opacity: 0; }
        }

        .gwi-title {
          font-size: 12px; font-weight: 600; color: rgba(255,255,255,0.92);
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .gwi-name { font-weight: 800; color: #c4b5fd; }
        .gwi-sub {
          font-size: 11px; color: rgba(255,255,255,0.45); margin-top: 1px;
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }

        .gwi-close {
          flex-shrink: 0; width: 22px; height: 22px; border-radius: 50%;
          background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.08);
          color: rgba(255,255,255,0.5); display: flex; align-items: center; justify-content: center;
          cursor: pointer; padding: 0; transition: background 0.15s, color 0.15s;
        }
        .gwi-close:hover { background: rgba(255,255,255,0.12); color: rgba(255,255,255,0.85); }
      `}</style>
    </div>
  )
}
