#!/usr/bin/env node
// scripts/wire-beyond.js
//
// Wires BEYOND into ChatPage.jsx (and MediaAttachmentFlow.jsx).
//
//   node scripts/wire-beyond.js src/pages/ChatPage.jsx src/components/media/MediaAttachmentFlow.jsx
//
// Safe by design:
//   - every edit must match EXACTLY ONE place, or nothing is written at all
//   - the original is saved next to the file as <name>.beyond.bak
//   - running it twice does nothing the second time
//
// If an anchor does not match (your file drifted from what I was given), it tells
// you which edit failed and leaves both files untouched.

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

const HOOKS_BLOCK = `

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

const HEADER_BUTTON = `{canBeyond && (
                  <button className="icon-btn dark" onClick={() => beyond.openBeyond()} title="Beyond (Alt+B)" aria-label="Open Beyond">
                    <BeyondGlyph size={18} />
                  </button>
                )}
                {!isReadOnlyChat && <div className="threedot-wrapper"`

const PORTAL_BLOCK = `
            {myLiveShare && (
              <LiveShareBar expiresAt={myLiveShare.expires_at} onStop={() => liveShare.stop(activeConvo.id).catch(() => alert("Couldn't stop sharing. Check your connection and try again."))} />
            )}
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

/* ───────────────────────── edits ───────────────────────── */

const chatEdits = [
  {
    name: 'imports',
    re: /import \{ motion \} from 'framer-motion'\n/,
    to: () => `import { motion } from 'framer-motion'
import { useBeyond } from '../beyond/useBeyond'
import { useLiveShare } from '../beyond/useLiveShare'
import BeyondPortal, { BeyondGlyph } from '../beyond/BeyondPortal'
import LiveShareBar from '../beyond/LiveShareBar'
`,
  },
  {
    name: 'swipe-to-reply (right only, with cancel)',
    re: /function useSwipeToReply\(onReply, msg\) \{[\s\S]*?\n\}\s*\nfunction SwipeableMessage/,
    to: () => NEW_SWIPE_HOOK,
  },
  {
    name: 'chatAreaRef',
    re: /const msgRefs = useRef\(\{\}\)\n/,
    to: () => `const msgRefs = useRef({})\n  const chatAreaRef = useRef(null)\n`,
  },
  {
    name: 'beyond + live-share hooks',
    re: /(const isReadOnlyChat =\s*!!activeConvo && !activeConvo\.isCurryAI &&\s*getOtherUserIsAdmin\(activeConvo, userId\) && !profile\?\.is_admin)/,
    to: (_m, g1) => g1 + HOOKS_BLOCK,
  },
  {
    name: 'popstate (system Back closes BEYOND first)',
    re: /const handlePopState = \(\) => setActiveConvo\(null\)/,
    to: () => `const handlePopState = () => { if (beyond.consumePop()) return; setActiveConvo(null) }`,
  },
  {
    name: 'chat-area ref',
    re: /<div className="chat-area">(\s*\{\/\* Header \*\/\})/,
    to: (_m, g1) => `<div className="chat-area" ref={chatAreaRef}>${g1}`,
  },
  {
    name: 'header entry button',
    re: /\{!isReadOnlyChat && <div className="threedot-wrapper"/,
    to: () => HEADER_BUTTON,
  },
  {
    name: 'live-share bar + BEYOND portal',
    re: /(<PinnedBar key=\{pinnedRefresh\} conversationId=\{activeConvo\?\.id\} onScrollTo=\{scrollToMessage\} \/>)/,
    to: (_m, g1) => g1 + PORTAL_BLOCK,
  },
  {
    name: 'allowLiveLocation prop',
    re: /onShareLocation=\{handleShareLocation\}/,
    to: () => `onShareLocation={handleShareLocation}\n    allowLiveLocation={!activeConvo.is_group}`,
  },
  {
    name: 'handleShareLocation (optional live share)',
    re: /const handleShareLocation = async \(coords\) => \{[\s\S]*?bumpConversationActivity\('[^']*Location'\)\s*\n\s*\}/,
    to: () => NEW_SHARE_LOCATION,
  },
]

const mediaEdits = [
  {
    name: 'props',
    re: /\{ sendMediaMessage, sendMomentMessage, onShareLocation, onShareContact, currentUserId \}/,
    to: () => `{ sendMediaMessage, sendMomentMessage, onShareLocation, onShareContact, currentUserId, allowLiveLocation = false }`,
  },
  {
    name: 'handleLocationConfirm signature',
    re: /const handleLocationConfirm = \(coords\) => \{/,
    to: () => `const handleLocationConfirm = (coords, opts) => {`,
  },
  {
    name: 'pass options up',
    re: /onShareLocation\?\.\(coords\)/,
    to: () => `onShareLocation?.(coords, opts)`,
  },
  {
    name: 'pass allowLive to modal',
    re: /onConfirm=\{handleLocationConfirm\}/,
    to: () => `onConfirm={handleLocationConfirm}\n        allowLive={allowLiveLocation}`,
  },
]

/* ───────────────────────── engine ───────────────────────── */

function plan(file, edits, doneMarker) {
  const original = fs.readFileSync(file, 'utf8')
  const crlf = original.includes('\r\n')
  let src = original.replace(/\r\n/g, '\n')
  if (src.includes(doneMarker)) return { file, skipped: true }
  const failures = []
  for (const e of edits) {
    const count = [...src.matchAll(new RegExp(e.re.source, 'g'))].length
    if (count !== 1) { failures.push(`  ✗ ${e.name}: expected exactly 1 match, found ${count}`); continue }
    src = src.replace(e.re, e.to)
  }
  return { file, original, src: crlf ? src.replace(/\n/g, '\r\n') : src, failures, count: edits.length }
}

const plans = [plan(chatPath, chatEdits, "from '../beyond/useBeyond'")]
if (mediaPath) plans.push(plan(mediaPath, mediaEdits, 'allowLiveLocation'))

const failed = plans.filter((p) => p.failures && p.failures.length)
if (failed.length) {
  for (const p of failed) { console.error(`\n${p.file}\n${p.failures.join('\n')}`) }
  console.error('\nNothing was changed. Send me the lines around the failed anchors and I will adjust.')
  process.exit(1)
}
for (const p of plans) {
  if (p.skipped) { console.log(`= ${p.file}: already wired, left alone`); continue }
  fs.writeFileSync(`${p.file}.beyond.bak`, p.original)
  fs.writeFileSync(p.file, p.src)
  console.log(`✓ ${p.file}: ${p.count} edits applied (backup: ${p.file}.beyond.bak)`)
}
