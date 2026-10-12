// src/components/ConnectedApps/ConnectedApps.jsx
// Full-screen app launcher. Tapping an app opens the real app/site.
//
// Props:
//   onClose            () => void       closes the screen (required)
//   theme              'light' | 'dark' optional; follows system if omitted
//   internalHandlers   { [appId]: () => void }  optional. If an app id is
//                      listed here (e.g. spotify), it opens inside Mattchat
//                      instead of leaving the app.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { APPS, CATEGORIES } from './connectedAppsData';

const LS_PINS = 'mattchat.apps.pins';
const LS_RECENT = 'mattchat.apps.recent';

function load(key) {
  try {
    const v = JSON.parse(localStorage.getItem(key));
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}
function save(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable: ignore */
  }
}

function AppIcon({ app }) {
  const [failed, setFailed] = useState(false);
  const src = `https://www.google.com/s2/favicons?domain=${app.domain}&sz=128`;
  return (
    <span className="ca-icon" style={{ '--glow': app.color }}>
      {failed ? (
        <span className="ca-fallback" style={{ background: app.color }}>
          {app.name.slice(0, 1)}
        </span>
      ) : (
        <img src={src} alt="" width="34" height="34" loading="lazy" onError={() => setFailed(true)} />
      )}
    </span>
  );
}

function Tile({ app, pinned, internal, onOpen, onTogglePin }) {
  const body = (
    <>
      <AppIcon app={app} />
      <span className="ca-name">{app.name}</span>
      {internal && <span className="ca-badge">In Mattchat</span>}
    </>
  );
  return (
    <li className="ca-tile">
      {internal ? (
        <button type="button" className="ca-open" onClick={() => onOpen(app)}>
          {body}
        </button>
      ) : (
        <a
          className="ca-open"
          href={app.url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => onOpen(app)}
          aria-label={`Open ${app.name}`}
        >
          {body}
        </a>
      )}
      <button
        type="button"
        className={`ca-pin${pinned ? ' is-on' : ''}`}
        onClick={() => onTogglePin(app.id)}
        aria-pressed={pinned}
        aria-label={pinned ? `Unpin ${app.name}` : `Pin ${app.name}`}
      >
        <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
          <path
            d="M12 3.2l2.7 5.6 6.1.8-4.5 4.2 1.1 6.1L12 17l-5.4 2.9 1.1-6.1L3.2 9.6l6.1-.8L12 3.2z"
            fill={pinned ? 'currentColor' : 'none'}
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
        </svg>
      </button>
    </li>
  );
}

export default function ConnectedApps({ onClose, theme, internalHandlers = {} }) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [pins, setPins] = useState(() => load(LS_PINS));
  const [recent, setRecent] = useState(() => load(LS_RECENT));

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const byId = useMemo(() => Object.fromEntries(APPS.map((a) => [a.id, a])), []);

  const handleOpen = useCallback(
    (app) => {
      setRecent((prev) => {
        const next = [app.id, ...prev.filter((id) => id !== app.id)].slice(0, 6);
        save(LS_RECENT, next);
        return next;
      });
      internalHandlers[app.id]?.();
    },
    [internalHandlers]
  );

  const togglePin = useCallback((id) => {
    setPins((prev) => {
      const next = prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id];
      save(LS_PINS, next);
      return next;
    });
  }, []);

  const q = query.trim().toLowerCase();
  const filtering = q.length > 0 || category !== 'all';

  const filtered = useMemo(
    () =>
      APPS.filter(
        (a) =>
          (category === 'all' || a.category === category) &&
          (!q || a.name.toLowerCase().includes(q) || a.category.includes(q))
      ),
    [q, category]
  );

  const pinnedApps = pins.map((id) => byId[id]).filter(Boolean);
  const recentApps = recent.map((id) => byId[id]).filter(Boolean);

  const renderGrid = (list) => (
    <ul className="ca-grid">
      {list.map((app) => (
        <Tile
          key={app.id}
          app={app}
          pinned={pins.includes(app.id)}
          internal={Boolean(internalHandlers[app.id])}
          onOpen={handleOpen}
          onTogglePin={togglePin}
        />
      ))}
    </ul>
  );

  return (
    <div className="ca-root" data-theme={theme} role="dialog" aria-label="Apps">
      <style>{CSS}</style>

      <header className="ca-header">
        <button type="button" className="ca-back" onClick={onClose} aria-label="Back">
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
            <path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <div>
          <h1 className="ca-title">Apps</h1>
          <p className="ca-sub">Tap an app to open it. Pin the ones you use most.</p>
        </div>
      </header>

      <div className="ca-search">
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
          <circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" strokeWidth="2" />
          <path d="M16 16l4.5 4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search apps"
          aria-label="Search apps"
        />
      </div>

      <nav className="ca-chips" aria-label="Categories">
        {CATEGORIES.map((c) => (
          <button
            key={c.id}
            type="button"
            className={`ca-chip${category === c.id ? ' is-on' : ''}`}
            onClick={() => setCategory(c.id)}
            aria-pressed={category === c.id}
          >
            {c.label}
          </button>
        ))}
      </nav>

      <main className="ca-scroll">
        {!filtering && pinnedApps.length > 0 && (
          <section>
            <h2 className="ca-h2">Pinned</h2>
            {renderGrid(pinnedApps)}
          </section>
        )}

        {!filtering && recentApps.length > 0 && (
          <section>
            <h2 className="ca-h2">Recently opened</h2>
            {renderGrid(recentApps)}
          </section>
        )}

        <section>
          <h2 className="ca-h2">{filtering ? 'Results' : 'All apps'}</h2>
          {filtered.length > 0 ? (
            renderGrid(filtered)
          ) : (
            <p className="ca-empty">
              No app matches "{query}". Try a different name, or pick a category above.
            </p>
          )}
        </section>

        <p className="ca-note">
          Apps open in their own app or a new browser tab. Mattchat never sees your accounts there.
        </p>
      </main>
    </div>
  );
}

const CSS = `
.ca-root{
  --bg:#faf8ff; --surface:#ffffff; --ink:#1b1530; --muted:#6c6585; --line:#e7e2f3;
  --accent:#7c3aed; --accent-ink:#ffffff; --chip:#efeafb;
  position:fixed; inset:0; z-index:60; display:flex; flex-direction:column;
  background:var(--bg); color:var(--ink);
  font-family:system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;
  padding-top:env(safe-area-inset-top,0px);
}
.ca-root[data-theme="dark"]{
  --bg:#120e1f; --surface:#1c1730; --ink:#f2eefc; --muted:#a39bc0; --line:#2c2545;
  --accent:#a78bfa; --accent-ink:#17102b; --chip:#241d3b;
}
@media (prefers-color-scheme:dark){
  .ca-root:not([data-theme="light"]){
    --bg:#120e1f; --surface:#1c1730; --ink:#f2eefc; --muted:#a39bc0; --line:#2c2545;
    --accent:#a78bfa; --accent-ink:#17102b; --chip:#241d3b;
  }
}
.ca-root *{box-sizing:border-box}
.ca-header{display:flex; align-items:center; gap:12px; padding:14px 16px 6px}
.ca-back{width:40px; height:40px; border-radius:50%; border:0; background:var(--chip); color:var(--ink); display:grid; place-items:center; cursor:pointer}
.ca-title{margin:0; font-size:26px; line-height:1.1; font-weight:750; letter-spacing:-0.02em}
.ca-sub{margin:3px 0 0; font-size:13.5px; color:var(--muted)}
.ca-search{display:flex; align-items:center; gap:10px; margin:12px 16px 4px; padding:0 14px; height:46px; border-radius:14px; background:var(--surface); border:1px solid var(--line); color:var(--muted)}
.ca-search:focus-within{border-color:var(--accent); box-shadow:0 0 0 3px color-mix(in srgb,var(--accent) 22%,transparent)}
.ca-search input{flex:1; min-width:0; border:0; outline:0; background:transparent; color:var(--ink); font-size:16px}
.ca-chips{display:flex; gap:8px; overflow-x:auto; padding:10px 16px 6px; scrollbar-width:none}
.ca-chips::-webkit-scrollbar{display:none}
.ca-chip{flex:none; height:34px; padding:0 14px; border-radius:999px; border:0; background:var(--chip); color:var(--ink); font-size:14px; font-weight:550; cursor:pointer}
.ca-chip.is-on{background:var(--accent); color:var(--accent-ink)}
.ca-scroll{flex:1; overflow-y:auto; padding:6px 16px calc(28px + env(safe-area-inset-bottom,0px)); -webkit-overflow-scrolling:touch}
.ca-h2{margin:18px 0 10px; font-size:15px; font-weight:700; color:var(--muted)}
.ca-grid{list-style:none; margin:0; padding:0; display:grid; grid-template-columns:repeat(auto-fill,minmax(88px,1fr)); gap:18px 8px}
.ca-tile{position:relative}
.ca-open{width:100%; display:flex; flex-direction:column; align-items:center; gap:8px; padding:6px 2px; border:0; background:transparent; color:inherit; font:inherit; text-decoration:none; cursor:pointer; border-radius:16px; -webkit-tap-highlight-color:transparent}
.ca-open:active .ca-icon{transform:scale(.94)}
.ca-open:focus-visible,.ca-pin:focus-visible,.ca-chip:focus-visible,.ca-back:focus-visible{outline:2px solid var(--accent); outline-offset:2px}
.ca-icon{width:60px; height:60px; border-radius:18px; background:#fff; display:grid; place-items:center; border:1px solid var(--line); box-shadow:0 8px 18px -8px color-mix(in srgb,var(--glow) 65%,transparent); transition:transform .12s ease}
.ca-icon img{border-radius:8px; display:block}
.ca-fallback{width:38px; height:38px; border-radius:11px; display:grid; place-items:center; color:#fff; font-weight:750; font-size:18px}
.ca-name{font-size:12.5px; font-weight:550; text-align:center; line-height:1.2; max-width:100%; overflow:hidden; text-overflow:ellipsis; white-space:nowrap}
.ca-badge{font-size:10.5px; color:var(--accent); font-weight:650}
.ca-pin{position:absolute; top:0; right:6px; width:28px; height:28px; border-radius:50%; border:0; background:transparent; color:var(--muted); display:grid; place-items:center; cursor:pointer; opacity:.55}
.ca-pin:hover,.ca-pin.is-on{opacity:1}
.ca-pin.is-on{color:#f5a524}
.ca-empty{margin:24px 4px; color:var(--muted); font-size:14.5px; line-height:1.5}
.ca-note{margin:28px 4px 0; color:var(--muted); font-size:12.5px; line-height:1.5}
@media (prefers-reduced-motion:reduce){.ca-icon{transition:none}}
`;
