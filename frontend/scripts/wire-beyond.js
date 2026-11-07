#!/usr/bin/env node
// scripts/wire-beyond.js  (v2.1)
//
//   node scripts/wire-beyond.js src/pages/ChatPage.jsx src/components/media/MediaAttachmentFlow.jsx
//
// Each edit is checked on its own, so this works on a fresh file AND on a file you
// already patched by hand: edits that are already there are skipped, missing ones are
// added, and the old BeyondPortal call (without `ctx`) is upgraded.
//
//   - an edit that must apply but cannot find its anchor stops everything: nothing is written
//   - the original is kept as <file>.beyond.bak
//   - at the end it prints a checklist, and exits with an error if anything is still missing

const fs = require('fs')

const [chatPath, mediaPath] = process.argv.slice(2)
if (!chatPath) {
  console.error('Usage: node scripts/wire-beyond.js <ChatPage.jsx> [MediaAttachmentFlow.jsx]')
  process.exit(1)
}

/* ───────────────────────── replacement text ───────────────────────── */

const NEW_SWIPE_HOOK = `function useSwipeToReply(onReply, msg) {
  // Right-swipe replies. Left-swipe is deliberately ignored here: it belongs to BEYOND,
  // which listens on the message list (see src/beyond/useBeyond.js).
  const start = useRef(null)
  const dxRef = useRef(0)
  const [dx, setDx] = useState(0)
  const [swiping, setSwiping] = useState(false)
  const THRESHOLD = 60
  const reset = () => { start.current = null; dxRef.current = 0; setDx(0); setSwiping(false) }
  return {
    style: { transform: \`translateX(\${dx}px)\`, transition: swiping ? 'none' : 'transform 0.2s ease' },
    handlers: {
      onPointerDown: (e) => { start.current = { x: e.clientX, y: e.clientY }; setSwiping(true) },
      onPointerMove: (e) => {
        if (!start.current) return
        const mx = e.clientX - start.current.x
        const my = e.clientY - start.current.y
        if (Math.abs(my) > Math.abs(mx) && dxRef.current === 0) return // vertical scroll, not a swipe
        dxRef.current = Math.max(0, Math.min(80, mx))                  // right only
        setDx(dxRef.current)
      },
      onPointerUp: () => { if (start.current && dxRef.current > THRESHOLD) onReply(msg); reset() },
      onPointerLeave: reset,
      onPointerCancel: reset,
    },
  }
}
function SwipeableMessage`

const HOOKS_FULL = `

  // ── BEYOND ──────────────────────────────────────────────────────────────
  const canBeyond = !!activeConvo && !activeConvo.isCurryAI && !activeConvo.is_group
    && !isUserBlocked && !isPeerBlocked && !isReadOnlyChat
  const beyond = useBeyond({
    chatRef: chatAreaRef,
    scrollerRef: messagesScrollRef,
    convoKey: activeConvo?.id,
    enabled: canBeyond,
  })
  const liveShare = useLiveShare(userId)
  const myLiveShare = liveShare.activeFor(activeConvo?.id)`

const HOOKS_LIVE_ONLY = `

  const liveShare = useLiveShare(userId)
  const myLiveShare = liveShare.activeFor(activeConvo?.id)`

const HEADER_BUTTON = `{canBeyond && (
                  <button className="icon-btn dark" onClick={() => beyond.openBeyond()} title="Beyond (Alt+B)" aria-label="Open Beyond">
                    <BeyondGlyph size={18} />
                  </button>
                )}
                {!isReadOnlyChat && <div className="threedot-wrapper"`

const LIVE_BAR = `
            {myLiveShare && (
              <LiveShareBar expiresAt={myLiveShare.expires_at} onStop={() => liveShare.stop(activeConvo.id).catch(() => alert("Couldn't stop sharing. Check your connection and try again."))} />
            )}`

const PORTAL = `
            {beyond.mounted && (
              <BeyondPortal
                beyond={beyond}
                ctx={{ conversationId: activeConvo.id, userId, liveShare }}
                contact={{
                  id: otherUserId,
                  name: getConvoName(activeConvo),
                  avatarUrl: getOtherUserAvatar(activeConvo, userId),
                  online: otherUserId ? isOnline(otherUserId) : false,
                  presenceLabel: !otherUserId ? '' : isOnline(otherUserId)
                    ? ({ busy: 'Busy', idle: 'Away' }[getPresenceStatus(otherUserId)] || 'Online')
                    : getLastSeenLabel(otherUserId),
                }}
              />
            )}`

const NEW_SHARE_LOCATION = `const handleShareLocation = async (coords, opts = {}) => {
  if (!activeConvo) return
  await supabase.from('messages').insert({
    conversation_id: activeConvo.id,
    sender_id: userId,
    content: JSON.stringify({ lat: coords.lat, lng: coords.lng }),
    message_type: 'location',
  })
  bumpConversationActivity('📍 Location')
  // Optional live sharing (1:1 chats only). The snapshot above is always sent first.
  if (opts.liveMinutes && !activeConvo.is_group) {
    try {
      await liveShare.start(activeConvo.id, opts.liveMinutes)
    } catch (e) {
      playSound('warning')
      alert(e?.code === 'denied'
        ? 'Location access is blocked, so live sharing did not start. Your location message was still sent.'
        : "Couldn't start live sharing. Your location message was still sent.")
    }
  }
}`

/* ───────────────────────── edits ─────────────────────────
   when(src) -> should this edit run?   re -> must match exactly once   to -> replacement   */

const IMPORT_LINES = [
  ["useBeyond } from '../beyond/useBeyond'", "import { useBeyond } from '../beyond/useBeyond'"],
  ["useLiveShare } from '../beyond/useLiveShare'", "import { useLiveShare } from '../beyond/useLiveShare'"],
  ["from '../beyond/BeyondPortal'", "import BeyondPortal, { BeyondGlyph } from '../beyond/BeyondPortal'"],
  ["from '../beyond/LiveShareBar'", "import LiveShareBar from '../beyond/LiveShareBar'"],
]

const chatEdits = [
  {
    name: 'imports',
    when: (s) => IMPORT_LINES.some(([m]) => !s.includes(m)),
    re: /import \{ motion \} from 'framer-motion'\n/,
    to: (_m, _o, _s) => null, // filled in below, needs the current source
  },
  {
    name: 'swipe-to-reply (right only, with cancel)',
    when: (s) => !s.includes('dxRef'),
    re: /function useSwipeToReply\(onReply, msg\) \{[\s\S]*?\n\}\s*\nfunction SwipeableMessage/,
    to: () => NEW_SWIPE_HOOK,
  },
  {
    name: 'chatAreaRef',
    when: (s) => !s.includes('const chatAreaRef = useRef(null)'),
    re: /const msgRefs = useRef\(\{\}\)\n/,
    to: () => `const msgRefs = useRef({})\n  const chatAreaRef = useRef(null)\n`,
  },
  {
    name: 'beyond + live-share hooks',
    when: (s) => !s.includes('const beyond = useBeyond('),
    re: /(const isReadOnlyChat =\s*!!activeConvo && !activeConvo\.isCurryAI &&\s*getOtherUserIsAdmin\(activeConvo, userId\) && !profile\?\.is_admin)/,
    to: (_m, g1) => g1 + HOOKS_FULL,
  },
  {
    name: 'live-share hook (added to an existing useBeyond call)',
    when: (s) => s.includes('const beyond = useBeyond(') && !s.includes('const liveShare = useLiveShare('),
    re: /const beyond = useBeyond\(\{[\s\S]*?\}\)/,
    to: (m) => m + HOOKS_LIVE_ONLY,
  },
  {
    name: 'popstate (system Back closes BEYOND first)',
    when: (s) => !s.includes('consumePop'), // also true for a hand-written handler that uses beyondRef.current?.consumePop()
    re: /const handlePopState = \(\) => setActiveConvo\(null\)/,
    to: () => `const handlePopState = () => { if (beyond.consumePop()) return; setActiveConvo(null) }`,
  },
  {
    name: 'chat-area ref',
    when: (s) => !s.includes('ref={chatAreaRef}'),
    re: /<div className="chat-area">(\s*\{\/\* Header \*\/\})/,
    to: (_m, g1) => `<div className="chat-area" ref={chatAreaRef}>${g1}`,
  },
  {
    name: 'header entry button',
    when: (s) => !s.includes('<BeyondGlyph'),
    re: /\{!isReadOnlyChat && <div className="threedot-wrapper"/,
    to: () => HEADER_BUTTON,
  },
  {
    name: 'live-share bar + BEYOND portal (new)',
    when: (s) => !s.includes('<BeyondPortal'),
    re: /(<PinnedBar key=\{pinnedRefresh\} conversationId=\{activeConvo\?\.id\} onScrollTo=\{scrollToMessage\} \/>)/,
    to: (_m, g1) => g1 + LIVE_BAR + PORTAL,
  },
  {
    name: 'BeyondPortal upgrade: pass ctx + contact id',
    when: (s) => s.includes('<BeyondPortal') && !/ctx=\{\{\s*conversationId/.test(s),
    re: /(<BeyondPortal\s+beyond=\{beyond\}\s*)contact=\{\{/,
    to: (_m, g1) => `${g1}ctx={{ conversationId: activeConvo.id, userId, liveShare }}\n                contact={{\n                  id: otherUserId,`,
  },
  {
    name: 'live-share bar (added next to existing portal)',
    when: (s) => s.includes('<BeyondPortal') && !s.includes('<LiveShareBar'),
    re: /\{beyond\.mounted && \(/,
    to: (m) => LIVE_BAR.trimStart() + '\n            ' + m,
  },
  {
    name: 'allowLiveLocation prop',
    when: (s) => !s.includes('allowLiveLocation='),
    re: /onShareLocation=\{handleShareLocation\}/,
    to: () => `onShareLocation={handleShareLocation}\n    allowLiveLocation={!activeConvo.is_group}`,
  },
  {
    name: 'handleShareLocation (optional live share)',
    when: (s) => !s.includes('opts.liveMinutes'),
    re: /const handleShareLocation = async \(coords\) => \{[\s\S]*?bumpConversationActivity\('[^']*Location'\)\s*\n\s*\}/,
    to: () => NEW_SHARE_LOCATION,
  },
]

const mediaEdits = [
  {
    name: 'props',
    when: (s) => !s.includes('allowLiveLocation'),
    re: /\{ sendMediaMessage, sendMomentMessage, onShareLocation, onShareContact, currentUserId \}/,
    to: () => `{ sendMediaMessage, sendMomentMessage, onShareLocation, onShareContact, currentUserId, allowLiveLocation = false }`,
  },
  {
    name: 'handleLocationConfirm signature',
    when: (s) => !s.includes('handleLocationConfirm = (coords, opts)'),
    re: /const handleLocationConfirm = \(coords\) => \{/,
    to: () => `const handleLocationConfirm = (coords, opts) => {`,
  },
  {
    name: 'pass options up',
    when: (s) => !s.includes('onShareLocation?.(coords, opts)'),
    re: /onShareLocation\?\.\(coords\)/,
    to: () => `onShareLocation?.(coords, opts)`,
  },
  {
    name: 'pass allowLive to modal',
    when: (s) => !s.includes('allowLive={allowLiveLocation}'),
    re: /onConfirm=\{handleLocationConfirm\}/,
    to: () => `onConfirm={handleLocationConfirm}\n        allowLive={allowLiveLocation}`,
  },
]

const chatChecklist = [
  ['useBeyond imported', "from '../beyond/useBeyond'"],
  ['useLiveShare imported', "from '../beyond/useLiveShare'"],
  ['BeyondPortal imported', "from '../beyond/BeyondPortal'"],
  ['LiveShareBar imported', "from '../beyond/LiveShareBar'"],
  ['chatAreaRef declared', 'const chatAreaRef = useRef(null)'],
  ['useBeyond called', 'const beyond = useBeyond('],
  ['useLiveShare called', 'const liveShare = useLiveShare('],
  ['system Back handled', 'consumePop'],
  ['chat-area has the ref', 'ref={chatAreaRef}'],
  ['header button', '<BeyondGlyph'],
  ['portal rendered', '<BeyondPortal'],
  ['portal gets ctx', /ctx=\{\{\s*conversationId/],
  ['live-share bar', '<LiveShareBar'],
  ['modal can offer live sharing', 'allowLiveLocation='],
  ['live share starts from the modal', 'opts.liveMinutes'],
  ['reply swipe is right-only', 'dxRef'],
]
const mediaChecklist = [
  ['allowLiveLocation prop', 'allowLiveLocation'],
  ['options passed up', 'onShareLocation?.(coords, opts)'],
  ['allowLive passed to modal', 'allowLive={allowLiveLocation}'],
]

/* ───────────────────────── engine ───────────────────────── */

const has = (src, m) => (m instanceof RegExp ? m.test(src) : src.includes(m))

function run(file, edits, checklist) {
  const original = fs.readFileSync(file, 'utf8')
  const crlf = original.includes('\r\n')
  let src = original.replace(/\r\n/g, '\n')
  const log = []
  const failures = []

  for (const e of edits) {
    if (!e.when(src)) { log.push(`  = ${e.name}: already there`); continue }
    const count = [...src.matchAll(new RegExp(e.re.source, 'g'))].length
    if (count !== 1) { failures.push(`  ✗ ${e.name}: expected exactly 1 anchor match, found ${count}`); continue }
    if (e.name === 'imports') {
      const missing = IMPORT_LINES.filter(([m]) => !src.includes(m)).map(([, line]) => line)
      src = src.replace(e.re, (m) => m + missing.join('\n') + '\n')
    } else {
      src = src.replace(e.re, e.to)
    }
    log.push(`  ✓ ${e.name}`)
  }
  const missing = checklist.filter(([, m]) => !has(src, m)).map(([label]) => label)
  return { file, original, src: crlf ? src.replace(/\n/g, '\r\n') : src, log, failures, missing, changed: src !== original.replace(/\r\n/g, '\n') }
}

const results = [run(chatPath, chatEdits, chatChecklist)]
if (mediaPath) results.push(run(mediaPath, mediaEdits, mediaChecklist))

const failed = results.filter((r) => r.failures.length)
if (failed.length) {
  for (const r of failed) console.error(`\n${r.file}\n${r.failures.join('\n')}`)
  console.error('\nNothing was changed. Send me the lines around the failed anchors and I will adjust.')
  process.exit(1)
}

let bad = false
for (const r of results) {
  console.log(`\n${r.file}\n${r.log.join('\n')}`)
  if (r.changed) {
    fs.writeFileSync(`${r.file}.beyond.bak`, r.original)
    fs.writeFileSync(r.file, r.src)
    console.log(`  saved (backup: ${r.file}.beyond.bak)`)
  }
  if (r.missing.length) { bad = true; console.log(`  ⚠ still missing: ${r.missing.join(', ')}`) }
  else console.log('  checklist: everything is in place')
}
process.exit(bad ? 1 : 0)
