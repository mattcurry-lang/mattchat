/* BecomeArtistModal.css
   Uses your theme variables (--bg-surface-1/2, --text-primary/secondary/muted, --border) with fallbacks. */

.ba-backdrop {
  position: fixed; inset: 0; z-index: 800; display: flex; align-items: flex-end; justify-content: center;
  background: rgba(10, 10, 18, 0.72); -webkit-backdrop-filter: blur(6px); backdrop-filter: blur(6px);
}
@media (min-width: 640px) { .ba-backdrop { align-items: center; padding: 24px; } }

.ba {
  --ba-a: #a78bfa;
  --ba-b: #6c63ff;
  --ba-card: var(--bg-surface-1, #14141f);
  --ba-field: rgba(255, 255, 255, 0.05);
  --ba-text: var(--text-primary, #f2f0f8);
  --ba-sub: var(--text-secondary, #c9c4dd);
  --ba-muted: var(--text-muted, #9d97b5);
  --ba-line: var(--border, rgba(255, 255, 255, 0.1));
  --ba-ease: cubic-bezier(0.2, 0.8, 0.2, 1);
  position: relative; width: 100%; max-width: 480px; max-height: 94vh; overflow-y: auto;
  padding: 22px 20px calc(20px + env(safe-area-inset-bottom, 0px));
  border-radius: 24px 24px 0 0; color: var(--ba-text); font-family: inherit;
  background: radial-gradient(120% 60% at 50% -10%, rgba(167, 139, 250, 0.16), transparent 60%), var(--ba-card);
  border: 1px solid var(--ba-line); border-bottom: 0;
  box-shadow: 0 -20px 60px rgba(0, 0, 0, 0.45);
}
@media (min-width: 640px) { .ba { border-radius: 24px; border-bottom: 1px solid var(--ba-line); box-shadow: 0 30px 80px rgba(0, 0, 0, 0.55); } }
.ba *, .ba *::before, .ba *::after { box-sizing: border-box; }
:where(.ba) button { font: inherit; color: inherit; background: none; border: 0; padding: 0; cursor: pointer; text-align: left; }
:where(.ba) button:disabled { cursor: not-allowed; }
:where(.ba) input, :where(.ba) textarea { font: inherit; color: inherit; }
.ba button:focus-visible { outline: 2px solid var(--ba-a); outline-offset: 2px; }
.ba i, .ba em { font-style: normal; }

.ba-close { position: absolute; top: 14px; right: 14px; width: 32px; height: 32px; border-radius: 50%; display: grid; place-items: center; color: var(--ba-sub); background: rgba(255, 255, 255, 0.08); transition: background 0.15s; }
.ba-close:hover:not(:disabled) { background: rgba(255, 255, 255, 0.16); }

/* ── header ───────────────────────────────────────────────────── */
.ba-head { display: flex; align-items: center; gap: 12px; padding-right: 40px; margin-bottom: 18px; }
.ba-badge { flex-shrink: 0; width: 44px; height: 44px; border-radius: 14px; display: grid; place-items: center; color: #fff; background: linear-gradient(135deg, var(--ba-a), var(--ba-b)); box-shadow: 0 12px 26px -10px rgba(108, 99, 255, 0.95); }
.ba-head h3 { margin: 0; font-size: 18px; font-weight: 900; letter-spacing: -0.3px; }
.ba-head p { margin: 3px 0 0; font-size: 12.5px; line-height: 1.4; color: var(--ba-muted); }

/* ── live preview ─────────────────────────────────────────────── */
.ba-preview { display: flex; align-items: center; gap: 14px; padding: 14px; border-radius: 18px; background: linear-gradient(135deg, rgba(167, 139, 250, 0.14), rgba(108, 99, 255, 0.05)); border: 1px solid rgba(167, 139, 250, 0.25); }
.ba-avatar {
  position: relative; flex-shrink: 0; width: 76px; height: 76px; border-radius: 50%; display: grid; place-items: center;
  font-size: 24px; font-weight: 900; color: #fff; background: linear-gradient(135deg, var(--ba-a), var(--ba-b));
  box-shadow: 0 0 0 3px rgba(167, 139, 250, 0.4), 0 14px 28px -10px rgba(108, 99, 255, 0.9);
  transition: transform 0.18s var(--ba-ease), box-shadow 0.18s;
}
.ba-avatar.is-over { transform: scale(1.06); box-shadow: 0 0 0 4px var(--ba-a), 0 14px 28px -10px rgba(108, 99, 255, 0.9); }
.ba-avatar img { width: 100%; height: 100%; object-fit: cover; border-radius: 50%; }
.ba-cam { position: absolute; right: -2px; bottom: -2px; width: 28px; height: 28px; border-radius: 50%; display: grid; place-items: center; color: #14121f; background: #fff; box-shadow: 0 4px 10px rgba(0, 0, 0, 0.4); transition: transform 0.12s; }
.ba-cam:hover:not(:disabled) { transform: scale(1.1); }
.ba-preview-text { min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.ba-preview-text b { font-size: 17px; font-weight: 900; letter-spacing: -0.2px; overflow-wrap: anywhere; }
.ba-preview-text span { font-size: 12.5px; line-height: 1.4; color: var(--ba-sub); overflow-wrap: anywhere; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.ba-preview-text .is-empty { color: var(--ba-muted); font-weight: 500; }
.ba-preview-text b.is-empty { font-weight: 700; }
.ba-preview-text small { margin-top: 4px; font-size: 11px; color: var(--ba-a); font-weight: 700; }
.ba-link { margin-top: 8px; font-size: 12px; font-weight: 700; color: var(--ba-a); }
.ba-link:hover:not(:disabled) { text-decoration: underline; }

/* ── fields ───────────────────────────────────────────────────── */
.ba-field { display: flex; flex-direction: column; gap: 6px; margin-top: 16px; }
.ba-field > span { display: flex; align-items: baseline; gap: 4px; font-size: 12.5px; font-weight: 700; color: var(--ba-sub); }
.ba-field > span em { font-weight: 500; color: var(--ba-muted); }
.ba-field > span i { margin-left: auto; font-size: 11px; font-weight: 500; color: var(--ba-muted); font-variant-numeric: tabular-nums; }
.ba-field input, .ba-field textarea {
  width: 100%; padding: 11px 13px; border-radius: 12px; font-size: 14px; outline: none; resize: none;
  border: 1px solid var(--ba-line); background: var(--ba-field); transition: border-color 0.15s, background 0.15s;
}
.ba-field input { height: 44px; padding-top: 0; padding-bottom: 0; }
.ba-field textarea { line-height: 1.45; font-family: inherit; }
.ba-field input::placeholder, .ba-field textarea::placeholder { color: var(--ba-muted); }
.ba-field input:focus, .ba-field textarea:focus { border-color: var(--ba-a); background: rgba(167, 139, 250, 0.07); }
.ba-field input[aria-invalid='true'] { border-color: #f87171; }
.ba-field input:disabled, .ba-field textarea:disabled { opacity: 0.6; }
.ba-hint { font-size: 12px; color: #fca5a5; }

/* ── reassurance, errors, CTA ─────────────────────────────────── */
.ba-perks { display: flex; flex-direction: column; gap: 7px; margin: 18px 0 0; padding: 0; list-style: none; }
.ba-perks li { display: flex; align-items: center; gap: 9px; font-size: 12.5px; color: var(--ba-sub); }
.ba-perks li span { flex-shrink: 0; width: 18px; height: 18px; border-radius: 50%; display: grid; place-items: center; color: #4ade80; background: rgba(74, 222, 128, 0.14); }
.ba-error { margin: 12px 0 0; padding: 9px 12px; border-radius: 11px; font-size: 12.5px; line-height: 1.4; color: #fca5a5; background: rgba(248, 113, 113, 0.12); }
.ba-cta {
  width: 100%; height: 48px; margin-top: 18px; border-radius: 15px; font-size: 14.5px; font-weight: 800; color: #fff; text-align: center;
  background: linear-gradient(135deg, var(--ba-a), var(--ba-b)); box-shadow: 0 14px 28px -12px rgba(108, 99, 255, 0.95);
  transition: transform 0.1s, opacity 0.15s, box-shadow 0.15s;
}
.ba-cta:hover:not(:disabled) { box-shadow: 0 16px 32px -10px rgba(108, 99, 255, 1); }
.ba-cta:active:not(:disabled) { transform: scale(0.985); }
.ba-cta:disabled { opacity: 0.65; box-shadow: none; }
.ba-fine { margin: 10px 0 0; font-size: 11px; line-height: 1.45; text-align: center; color: var(--ba-muted); }

@media (prefers-reduced-motion: reduce) {
  .ba, .ba *, .ba *::before, .ba *::after { animation: none !important; transition: none !important; }
}
