// src/components/youtube/youtubeStyles.js
// Styles for the YouTube card (chat) and the YouTube page (Pulse).
// Injected once. Every colour is a CSS variable defined on `.mc-yt`, so nothing here
// can leak into the rest of the app.
//
// The palette (why these colours):
//   * surface #1b1930  = your existing --dark-card, a purple-tinted near-black (never pure black)
//   * text #f4f1ff     = off-white; pure white on near-black glares
//   * two accents only = violet #a78bfa and cyan #67e8f9 (lightened for dark backgrounds)
//   * primary buttons  = a DEEPENED violet-to-cyan gradient (#6d28d9 -> #0e7490) so white
//                        text on it stays above 4.5:1 contrast on both ends
//   * picture glow     = a blurred copy of the thumbnail behind the card (YouTube's own
//                        "ambient" technique). Text never sits on it, so colour changes
//                        can't hurt readability.

const CSS = `
.mc-yt{
  --yt-bg:#13111c; --yt-surface:#1b1930; --yt-raised:#262246; --yt-line:rgba(255,255,255,.09);
  --yt-text:#f4f1ff; --yt-text2:#b8b2d6; --yt-text3:#9a94bd;
  --yt-violet:#a78bfa; --yt-cyan:#67e8f9; --yt-pink:#f0abfc;
  --yt-ok:#4ade80; --yt-warn:#fbbf24; --yt-bad:#fb7185;
  --yt-grad:linear-gradient(135deg,#6d28d9,#0e7490);
  color:var(--yt-text); font-family:inherit;
}
.mc-yt,.mc-yt *,.mc-yt *::before,.mc-yt *::after{box-sizing:border-box}
.mc-yt button{font-family:inherit; cursor:pointer; -webkit-tap-highlight-color:transparent}
.mc-yt :focus-visible{outline:2px solid var(--yt-cyan); outline-offset:2px}

/* ── shared pieces ─────────────────────────────────────── */
.mc-yt-img{position:absolute; inset:0; width:100%; height:100%; object-fit:cover; transition:transform .5s cubic-bezier(.2,.7,.2,1)}
.mc-yt-scrim{position:absolute; inset:0; pointer-events:none; background:linear-gradient(to top,rgba(10,8,24,.78) 0%,rgba(10,8,24,.04) 46%,rgba(10,8,24,.34) 100%)}
.mc-yt-chip{position:absolute; top:8px; left:8px; padding:3px 9px; border-radius:999px; background:rgba(12,10,28,.62); -webkit-backdrop-filter:blur(8px); backdrop-filter:blur(8px); border:1px solid rgba(255,255,255,.14); font-size:11px; font-weight:700; letter-spacing:.02em; color:#fff}
.mc-yt-dur{position:absolute; bottom:8px; right:8px; padding:2px 7px; border-radius:7px; background:rgba(8,6,20,.84); color:#fff; font-size:11.5px; font-weight:700; font-variant-numeric:tabular-nums}
.mc-yt-play{position:absolute; left:50%; top:50%; width:54px; height:54px; margin:-27px 0 0 -27px; border-radius:50%; display:grid; place-items:center; background:rgba(255,255,255,.16); border:1.5px solid rgba(255,255,255,.55); -webkit-backdrop-filter:blur(10px); backdrop-filter:blur(10px); box-shadow:0 8px 24px rgba(0,0,0,.45); transition:transform .25s cubic-bezier(.2,.9,.3,1.4),background .25s,opacity .2s}
.mc-yt-play svg{margin-left:3px}
.mc-yt-avatar{width:20px; height:20px; border-radius:50%; display:grid; place-items:center; font-size:10px; font-weight:800; color:#fff; flex:none}
.mc-yt-skel{border-radius:8px; background:linear-gradient(100deg,rgba(255,255,255,.06) 30%,rgba(255,255,255,.14) 50%,rgba(255,255,255,.06) 70%); background-size:220% 100%; animation:mc-yt-shimmer 1.4s linear infinite}
@keyframes mc-yt-shimmer{from{background-position:120% 0}to{background-position:-120% 0}}

.mc-yt-btn{display:inline-flex; align-items:center; gap:6px; height:32px; padding:0 12px; border-radius:999px; border:1px solid var(--yt-line); background:rgba(255,255,255,.06); color:var(--yt-text); font-size:12.5px; font-weight:650; transition:background .2s,transform .15s,border-color .2s,filter .2s}
.mc-yt-btn:hover{background:rgba(255,255,255,.11); border-color:rgba(255,255,255,.18)}
.mc-yt-btn:active{transform:scale(.97)}
.mc-yt-btn[disabled]{opacity:.55; cursor:default}
.mc-yt-btn--primary{background:var(--yt-grad); border-color:transparent; color:#fff}
.mc-yt-btn--primary:hover{background:var(--yt-grad); filter:brightness(1.14)}
.mc-yt-btn--violet{background:rgba(167,139,250,.14); border-color:rgba(167,139,250,.35); color:#ddd6fe}
.mc-yt-link{display:inline-flex; align-items:center; gap:4px; height:32px; padding:0 6px; color:var(--yt-text2); font-size:12px; text-decoration:none}
.mc-yt-link:hover{color:var(--yt-text); text-decoration:underline}
.mc-yt-input{flex:1; min-width:0; height:34px; border-radius:10px; border:1px solid var(--yt-line); background:rgba(0,0,0,.25); color:var(--yt-text); padding:0 11px; font-size:13px; font-family:inherit}
.mc-yt-input::placeholder{color:var(--yt-text3)}

/* ── chat card ─────────────────────────────────────────── */
.mc-ytc{position:relative; isolation:isolate; max-width:100%}
.mc-ytc-glow{position:absolute; inset:-14px -10px -6px; z-index:-1; border-radius:28px; background-size:cover; background-position:center; filter:blur(26px) saturate(1.7); opacity:.5; transform:scale(1.04); pointer-events:none; transition:opacity .4s}
.mc-ytc:hover .mc-ytc-glow{opacity:.72}
.mc-ytc-card{background:linear-gradient(180deg,rgba(255,255,255,.045),rgba(255,255,255,0) 42%),var(--yt-surface); border:1px solid var(--yt-line); border-radius:20px; padding:6px; box-shadow:0 12px 32px -14px rgba(0,0,0,.7)}
.mc-ytc-media{position:relative; display:block; width:100%; padding:0; border:0; border-radius:14px; overflow:hidden; background:#0b0a14; aspect-ratio:16/9}
.mc-ytc-media:hover .mc-yt-img{transform:scale(1.045)}
.mc-ytc-media:hover .mc-yt-play{transform:scale(1.1); background:rgba(255,255,255,.26)}
.mc-ytc-media:active .mc-yt-play{transform:scale(.96)}
.mc-ytc-body{padding:10px 8px 4px}
.mc-ytc-title{display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; border:0; background:none; padding:0; text-align:left; color:var(--yt-text); font-size:14px; line-height:1.35; font-weight:650; overflow-wrap:anywhere}
.mc-ytc-title:hover{color:#fff; text-decoration:underline; text-decoration-color:rgba(255,255,255,.35); text-underline-offset:3px}
.mc-ytc-channel{display:flex; align-items:center; gap:7px; margin-top:7px; font-size:12px; color:var(--yt-text2)}
.mc-ytc-actions{display:flex; flex-wrap:wrap; align-items:center; gap:6px; padding:8px 4px 4px}

.mc-ytc-panel{display:grid; grid-template-rows:0fr; transition:grid-template-rows .35s cubic-bezier(.2,.8,.2,1)}
.mc-ytc-panel[data-open="true"]{grid-template-rows:1fr}
.mc-ytc-panel>div{overflow:hidden; min-height:0}
.mc-ytc-panel-in{margin:6px 2px 4px; padding:12px; border-radius:14px; background:rgba(255,255,255,.04); border:1px solid var(--yt-line); display:flex; flex-direction:column; gap:12px}
.mc-yt-top{display:flex; align-items:flex-start; justify-content:space-between; gap:10px}
.mc-yt-sum{font-size:13px; line-height:1.5; font-weight:550; color:var(--yt-text)}
.mc-yt-badge{font-size:10.5px; font-weight:800; letter-spacing:.04em; text-transform:uppercase; white-space:nowrap; border:1px solid currentColor; border-radius:999px; padding:2px 8px}
.mc-yt-h{font-size:11.5px; font-weight:700; color:var(--yt-text3); margin-bottom:3px}
.mc-yt-row{display:flex; gap:8px; align-items:baseline; width:100%; background:none; border:0; text-align:left; padding:5px 6px; border-radius:8px; color:var(--yt-text2); font-size:12.5px; line-height:1.4}
.mc-yt-row:hover{background:rgba(255,255,255,.06); color:var(--yt-text)}
.mc-yt-ts{flex:none; font-variant-numeric:tabular-nums; font-weight:750; font-size:11.5px; color:var(--yt-cyan); background:rgba(103,232,249,.1); border-radius:6px; padding:1px 6px}
.mc-yt-a{display:block; font-size:12.5px; color:var(--yt-violet); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; padding:2px 0}
.mc-yt-decks{display:flex; gap:6px}
.mc-yt-decks .mc-yt-btn{flex:1; justify-content:center}
.mc-yt-notes{font-size:12.5px; color:var(--yt-text2)}
.mc-yt-notes summary{cursor:pointer; color:var(--yt-violet); font-weight:700}
.mc-yt-notes div{margin-top:5px; white-space:pre-wrap; line-height:1.5}
.mc-yt-ask{display:flex; gap:6px}
.mc-yt-answer{font-size:12.5px; line-height:1.5; color:var(--yt-text); background:rgba(167,139,250,.1); border:1px solid rgba(167,139,250,.22); border-radius:10px; padding:9px 11px}
.mc-yt-note{font-size:12.5px; color:var(--yt-text2)}
.mc-yt-err{font-size:12.5px; color:#fda4af}

/* ── Pulse page ────────────────────────────────────────── */
.mc-ytp{position:relative; isolation:isolate; display:flex; flex-direction:column; gap:18px; padding:16px 16px 40px; max-width:980px; margin:0 auto}
.mc-ytp::before{content:""; position:absolute; z-index:-1; inset:-40px -20px auto -20px; height:260px; pointer-events:none; background:radial-gradient(60% 100% at 18% 0%,rgba(124,58,237,.34),transparent 70%),radial-gradient(50% 100% at 88% 0%,rgba(8,145,178,.26),transparent 70%)}
.mc-ytp-head{display:flex; align-items:center; gap:12px}
.mc-ytp-back{width:38px; height:38px; flex:none; border-radius:50%; display:grid; place-items:center; border:1px solid var(--yt-line); background:rgba(255,255,255,.06); color:var(--yt-text)}
.mc-ytp-back:hover{background:rgba(255,255,255,.12)}
.mc-ytp-title{margin:0; font-size:24px; line-height:1.1; font-weight:800; letter-spacing:-.02em}
.mc-ytp-sub{margin:3px 0 0; font-size:13px; color:var(--yt-text2)}
.mc-ytp-search{display:flex; align-items:center; gap:8px; padding:6px 6px 6px 14px; border-radius:18px; background:rgba(27,25,48,.8); -webkit-backdrop-filter:blur(14px); backdrop-filter:blur(14px); border:1px solid var(--yt-line); transition:border-color .2s,box-shadow .2s}
.mc-ytp-search:focus-within{border-color:rgba(103,232,249,.55); box-shadow:0 0 0 4px rgba(103,232,249,.12)}
.mc-ytp-search svg{flex:none; color:var(--yt-text3)}
.mc-ytp-search input{flex:1; min-width:0; height:40px; border:0; background:transparent; outline:none; color:var(--yt-text); font-size:16px; font-family:inherit}
.mc-ytp-search input::placeholder{color:var(--yt-text3)}
.mc-ytp-clear{width:30px; height:30px; flex:none; border:0; border-radius:50%; background:rgba(255,255,255,.08); color:var(--yt-text2); display:grid; place-items:center}
.mc-ytp-go{height:40px; padding:0 18px; border:0; border-radius:13px; background:var(--yt-grad); color:#fff; font-size:14px; font-weight:700}
.mc-ytp-go[disabled]{opacity:.6}
.mc-ytp-subhead{display:flex; align-items:center; justify-content:space-between; margin-bottom:10px; font-size:13px; font-weight:700; color:var(--yt-text2)}
.mc-ytp-text{background:none; border:0; color:var(--yt-violet); font-size:12.5px; font-weight:700}
.mc-ytp-chips{display:flex; flex-wrap:wrap; gap:8px}
.mc-ytp-chip{display:inline-flex; align-items:center; gap:2px; height:36px; padding:0 4px 0 12px; border-radius:999px; background:rgba(255,255,255,.06); border:1px solid var(--yt-line); color:var(--yt-text); font-size:13px}
.mc-ytp-chip>button{display:inline-flex; align-items:center; gap:7px; background:none; border:0; color:inherit; font-size:13px; padding:0 4px 0 0; height:100%}
.mc-ytp-chip>button.x{width:26px; height:26px; justify-content:center; border-radius:50%; padding:0; color:var(--yt-text3)}
.mc-ytp-chip>button.x:hover{background:rgba(255,255,255,.1); color:var(--yt-text)}
.mc-ytp-results{container-type:inline-size}
.mc-ytp-grid{display:grid; grid-template-columns:repeat(auto-fill,minmax(230px,1fr)); gap:22px 14px}
@container (min-width:640px){
  .mc-ytp-card--hero{grid-column:span 2}
  .mc-ytp-card--hero .mc-ytp-name{font-size:17px}
}
.mc-ytp-card{position:relative; isolation:isolate; display:flex; flex-direction:column; gap:10px; padding:0; border:0; background:none; text-align:left; color:inherit; min-width:0}
.mc-ytp-glow{position:absolute; inset:-16px; z-index:-1; border-radius:30px; background-size:cover; background-position:center; filter:blur(30px) saturate(1.7); opacity:.4; pointer-events:none}
.mc-ytp-thumb{position:relative; aspect-ratio:16/9; border-radius:14px; overflow:hidden; background:#0b0a14; box-shadow:0 8px 22px -12px rgba(0,0,0,.7); transition:box-shadow .3s,transform .3s}
.mc-ytp-card:hover .mc-ytp-thumb,.mc-ytp-card:focus-visible .mc-ytp-thumb{transform:translateY(-2px); box-shadow:0 16px 36px -14px rgba(103,232,249,.38)}
.mc-ytp-card:hover .mc-yt-img{transform:scale(1.045)}
.mc-ytp-card .mc-yt-play{opacity:0; transform:scale(.85)}
.mc-ytp-card:hover .mc-yt-play,.mc-ytp-card:focus-visible .mc-yt-play{opacity:1; transform:scale(1)}
@media (hover:none){ .mc-ytp-card .mc-yt-play{opacity:.92; transform:none} }
.mc-ytp-meta{display:flex; gap:10px; padding:0 2px}
.mc-ytp-info{min-width:0}
.mc-ytp-name{display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; font-size:14px; font-weight:650; line-height:1.35; overflow-wrap:anywhere}
.mc-ytp-ch{margin-top:3px; font-size:12px; color:var(--yt-text2)}
.mc-ytp-stats{margin-top:2px; font-size:11.5px; color:var(--yt-text3)}
.mc-ytp-empty{display:flex; flex-direction:column; align-items:center; gap:10px; padding:44px 16px; text-align:center; color:var(--yt-text2); font-size:14px}
.mc-ytp-empty .ico{width:60px; height:60px; border-radius:50%; display:grid; place-items:center; background:rgba(255,255,255,.06); border:1px solid var(--yt-line); color:var(--yt-violet)}
.mc-ytp-more{align-self:center; margin-top:8px}

/* ── Search pop-up inside a chat ───────────────────────── */
.mc-ytm-overlay{position:fixed; inset:0; z-index:950; display:flex; align-items:center; justify-content:center; padding:16px; background:rgba(6,5,14,.66); -webkit-backdrop-filter:blur(6px); backdrop-filter:blur(6px); animation:mc-ytm-fade .18s ease-out}
.mc-ytm-panel{position:relative; width:min(780px,100%); height:min(86vh,780px); overflow-x:hidden; overflow-y:auto; overscroll-behavior:contain; background:#13111c; border:1px solid rgba(255,255,255,.1); border-radius:24px; box-shadow:0 30px 80px -20px rgba(0,0,0,.85); animation:mc-ytm-pop .22s cubic-bezier(.2,.9,.3,1.1)}
.mc-ytp-head--modal .mc-ytp-back{order:2; margin-left:auto}
@media (max-width:640px){
  .mc-ytm-overlay{align-items:flex-end; padding:0}
  .mc-ytm-panel{width:100%; height:92vh; border-radius:24px 24px 0 0; padding-bottom:env(safe-area-inset-bottom,0px)}
}
@supports (height:1dvh){ @media (max-width:640px){ .mc-ytm-panel{height:92dvh} } }
@keyframes mc-ytm-fade{from{opacity:0}to{opacity:1}}
@keyframes mc-ytm-pop{from{opacity:0; transform:translateY(14px) scale(.98)}to{opacity:1; transform:none}}
@media (prefers-reduced-motion:reduce){ .mc-ytm-overlay,.mc-ytm-panel{animation:none} }

/* ── Video player opened from a chat ───────────────────── */
.mc-ytv-backdrop{position:fixed; inset:0; z-index:599; background:rgba(8,7,16,.94); overflow:hidden}
.mc-ytv-glow{position:absolute; inset:-60px; background-size:cover; background-position:center; filter:blur(70px) saturate(1.6); opacity:.38; pointer-events:none}
.mc-ytv-frame{position:fixed; z-index:600; background:#000; overflow:hidden; aspect-ratio:16/9}
.mc-ytv-frame--full{top:50%; left:50%; transform:translate(-50%,-50%); width:min(92vw,900px); border-radius:18px; box-shadow:0 30px 80px -20px rgba(0,0,0,.8),0 0 0 1px rgba(255,255,255,.08)}
.mc-ytv-frame--mini{bottom:90px; right:16px; width:240px; border-radius:16px; box-shadow:0 14px 38px -10px rgba(0,0,0,.65),0 0 0 1px rgba(255,255,255,.12)}
.mc-ytv-bar{position:fixed; z-index:601; display:flex; gap:8px}
.mc-ytv-bar--full{top:calc(env(safe-area-inset-top,0px) + 12px); right:16px}
.mc-ytv-bar--mini{bottom:calc(90px + 135px + 8px); right:16px; width:240px; justify-content:flex-end}
.mc-ytv-btn{display:inline-flex; align-items:center; gap:6px; height:34px; padding:0 13px; border-radius:999px; border:1px solid rgba(255,255,255,.16); background:rgba(27,25,48,.72); -webkit-backdrop-filter:blur(12px); backdrop-filter:blur(12px); color:#f4f1ff; font-size:12.5px; font-weight:650; transition:background .2s,transform .15s}
.mc-ytv-btn:hover{background:rgba(255,255,255,.18)}
.mc-ytv-btn:active{transform:scale(.96)}
.mc-ytv-btn--icon{width:34px; padding:0; justify-content:center}
.mc-ytv-btn--bad:hover{background:rgba(251,113,133,.32)}

@media (prefers-reduced-motion:reduce){
  .mc-yt *,.mc-yt *::before,.mc-yt *::after{animation:none!important; transition:none!important}
}
`

export function ensureYouTubeStyles() {
  if (typeof document === 'undefined') return
  if (document.getElementById('mc-yt-styles')) return
  const el = document.createElement('style')
  el.id = 'mc-yt-styles'
  el.textContent = CSS
  document.head.appendChild(el)
}

export const YT_CSS = CSS
