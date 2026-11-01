import React, { useEffect, useMemo, useRef, useState } from 'react'
import Avatar from './Avatar'
import StatusRing from './StatusRing'
import { IconPlus } from './Icons'
import NoteComposerSheet from './NoteComposerSheet'
import NoteReplySheet from './NoteReplySheet'
import { buildPresenceItems, agingOpacity, timeLeft } from '../lib/presence'

/**
 * Presence Rail — notes + statuses + stories in ONE row, ONE chip per person.
 *
 *   ring around the avatar  = their story (gradient = new, grey = seen, still tappable)
 *   bubble above            = their note, or their status if they have no note
 *   corner emoji            = their status emoji
 *   tap the avatar          = open their story (or the chat if they have none)
 *   tap the bubble          = react / reply (it lands in the chat like a normal message)
 *
 * It replaces the old two-row setup (NotesRail + story rail), which listed the same person twice.
 */

// pops the bubble once when a person's note changes while you're looking (not on first load)
function useJustChanged(value) {
  const prev = useRef(value)
  const [pop, setPop] = useState(false)
  useEffect(() => {
    if (prev.current === value) return undefined
    prev.current = value
    if (!value) return undefined
    setPop(true)
    const id = setTimeout(() => setPop(false), 900)
    return () => clearTimeout(id)
  }, [value])
  return pop
}

function Bubble({ text, onClick, expiresAt, disabled, dashed, label }) {
  const pop = useJustChanged(text)
  const left = timeLeft(expiresAt)
  const Tag = disabled ? 'div' : 'button'
  return (
    <Tag
      className={`pr-bubble${dashed ? ' is-dashed' : ''}${pop ? ' is-pop' : ''}${disabled ? ' is-static' : ''}`}
      style={{ opacity: dashed ? undefined : agingOpacity(expiresAt) }}
      onClick={disabled ? undefined : onClick}
      title={left ? `${text} · ${left}` : text}
      aria-label={label}
    >
      <span className="pr-bubble-text">{text}</span>
    </Tag>
  )
}

function FriendChip({ item, onOpenStory, onOpenConversation, onOpenReply }) {
  const first = (item.name || 'Unknown').split(' ')[0]
  const canReply = !!item.convo && !!item.bubbleText
  const openAvatar = () => (item.story ? onOpenStory(item.userId) : item.convo && onOpenConversation(item.convo))
  return (
    <div className="pr-item" role="listitem">
      <div className="pr-bubble-slot">
        {item.bubbleText && (
          <Bubble
            text={item.bubbleText}
            expiresAt={item.hasNote ? item.noteExpiresAt : null}
            disabled={!canReply}
            onClick={() => onOpenReply(item)}
            label={`${first}'s ${item.hasNote ? 'note' : 'status'}: ${item.bubbleText}. ${canReply ? 'Tap to react or reply' : ''}`}
          />
        )}
      </div>
      <div className="pr-avatar-wrap">
        <button
          className="pr-avatar story-item"
          onClick={openAvatar}
          aria-label={item.story ? `${first}: ${item.unseen ? 'new ' : ''}status` : `Open chat with ${first}`}
        >
          <StatusRing size={58} hasStatus={!!item.story} viewed={item.story?.allViewed}>
            <Avatar name={item.name} size={52} photoUrl={item.avatarUrl} />
          </StatusRing>
        </button>
        {item.vibeEmoji && <span className="pr-vibe" aria-hidden>{item.vibeEmoji}</span>}
      </div>
      <span className="pr-name">{first}</span>
    </div>
  )
}

export default function PresenceRail({
  conversations, userId, extras, getOtherId, getAvatar, getName,
  me, myStatuses = [], statusGroups = [],
  onOpenStory, onAddStatus, onOpenConversation,
  onSaveNote, onReplyToNote, trailing,
}) {
  const [composer, setComposer] = useState(false)
  const [replyTo, setReplyTo] = useState(null)
  const [toast, setToast] = useState(null)       // { text, convo }

  const items = useMemo(
    () => buildPresenceItems({ conversations, userId, extras, getOtherId, getAvatar, getName, statusGroups }),
    [conversations, userId, extras, getOtherId, getAvatar, getName, statusGroups],
  )

  const mine = extras.get(userId)
  const myNote = mine?.note || ''
  const myVibe = (mine?.statusText || mine?.statusEmoji) ? `${mine.statusEmoji || ''} ${mine.statusText || ''}`.trim() : ''
  const myBubble = myNote || myVibe

  useEffect(() => {
    if (!toast) return undefined
    const id = setTimeout(() => setToast(null), 3200)
    return () => clearTimeout(id)
  }, [toast])

  const sendReply = async (text) => {
    const ok = await onReplyToNote(replyTo.convo, text, replyTo.bubbleText)
    if (ok) {
      setToast({ text: `Sent ${text.length <= 3 ? text + ' ' : ''}to ${(replyTo.name || '').split(' ')[0]}`, convo: replyTo.convo })
      setReplyTo(null)
    }
    return ok
  }

  return (
    <>
      <div className="pr-rail" role="list" aria-label="Notes and status updates">
        {/* YOU — always first. avatar = your story, bubble = your note, + = add a status */}
        <div className="pr-item pr-me" role="listitem">
          <div className="pr-bubble-slot">
            <Bubble
              text={myBubble || '+ Share a thought'}
              dashed={!myBubble}
              expiresAt={myNote ? mine?.noteExpiresAt : null}
              onClick={() => setComposer(true)}
              label={myBubble ? `Your note: ${myBubble}. Tap to edit` : 'Share a note with your friends'}
            />
          </div>
          <div className="pr-avatar-wrap">
            <button className="pr-avatar story-item" onClick={() => onOpenStory('mine')} aria-label={myStatuses.length ? 'View your status' : 'Add a status'}>
              <StatusRing size={58} hasStatus={myStatuses.length > 0} viewed>
                <Avatar name={me?.name || 'You'} size={52} photoUrl={me?.avatarUrl} />
              </StatusRing>
            </button>
            {me?.badge}
            {mine?.statusEmoji && <span className="pr-vibe" aria-hidden>{mine.statusEmoji}</span>}
            <button className="status-add-badge" onClick={onAddStatus} aria-label="Add status" title="Add status"><IconPlus size={11} /></button>
          </div>
          <span className="pr-name">You</span>
        </div>

        {items.map((item) => (
          <FriendChip
            key={item.userId}
            item={item}
            onOpenStory={onOpenStory}
            onOpenConversation={onOpenConversation}
            onOpenReply={setReplyTo}
          />
        ))}

        {trailing}
      </div>

      {composer && (
        <NoteComposerSheet
          name={me?.name}
          avatarUrl={me?.avatarUrl}
          initial={{ note: myNote, vibeEmoji: mine?.statusEmoji || '', vibeText: mine?.statusText || '' }}
          onSave={onSaveNote}
          onClose={() => setComposer(false)}
        />
      )}
      {replyTo && (
        <NoteReplySheet
          item={replyTo}
          onSend={sendReply}
          onOpenChat={() => { const c = replyTo.convo; setReplyTo(null); onOpenConversation(c) }}
          onClose={() => setReplyTo(null)}
        />
      )}

      {toast && (
        <div className="pr-toast" role="status">
          <span>{toast.text}</span>
          <button onClick={() => { const c = toast.convo; setToast(null); onOpenConversation(c) }}>Open chat</button>
        </div>
      )}
    </>
  )
}

if (typeof document !== 'undefined' && !document.getElementById('presence-rail-styles')) {
  const el = document.createElement('style')
  el.id = 'presence-rail-styles'
  el.textContent = `
    @keyframes prPop { 0% { transform:scale(.6) translateY(8px); opacity:0; } 55% { transform:scale(1.08); opacity:1; } 100% { transform:none; } }
    @keyframes prToastIn { from { opacity:0; transform:translate(-50%, 12px); } to { opacity:1; transform:translate(-50%, 0); } }

    .pr-rail { display:flex; gap:6px; overflow-x:auto; padding:2px 14px 10px; scrollbar-width:none; -webkit-overflow-scrolling:touch; scroll-snap-type:x proximity;
      -webkit-mask-image:linear-gradient(90deg, #000 90%, transparent); mask-image:linear-gradient(90deg, #000 90%, transparent); }
    .pr-rail::-webkit-scrollbar { display:none; }
    .pr-item { flex:0 0 78px; width:78px; display:flex; flex-direction:column; align-items:center; scroll-snap-align:start; }
    .pr-bubble-slot { min-height:46px; width:100%; display:flex; align-items:flex-end; justify-content:center; margin-bottom:10px; }

    .pr-bubble { position:relative; max-width:76px; padding:6px 9px; border-radius:15px; border:1px solid rgba(255,255,255,.14); cursor:pointer; font-family:inherit; text-align:center;
      background:var(--chip-bg, rgba(255,255,255,.09)); color:var(--dark-text, #f5f5fa); font-size:11px; font-weight:700; line-height:1.25;
      transition:transform .15s ease, border-color .15s ease; }
    .pr-bubble:hover { border-color:rgba(167,139,250,.6); transform:translateY(-1px); }
    .pr-bubble:active { transform:scale(.96); }
    .pr-bubble:focus-visible, .pr-avatar:focus-visible { outline:2px solid #a78bfa; outline-offset:2px; }
    .pr-bubble.is-static { cursor:default; }
    .pr-bubble.is-static:hover { transform:none; border-color:rgba(255,255,255,.14); }
    .pr-bubble::after { content:''; position:absolute; left:50%; bottom:-5px; width:9px; height:9px; margin-left:-4px; transform:rotate(45deg);
      background:inherit; border-right:1px solid rgba(255,255,255,.14); border-bottom:1px solid rgba(255,255,255,.14); border-bottom-right-radius:3px; }
    .pr-bubble.is-pop { animation:prPop .6s cubic-bezier(.2,.9,.3,1.2); }
    .pr-bubble.is-dashed { background:transparent; border-style:dashed; color:var(--dark-muted, rgba(255,255,255,.55)); font-weight:600; }
    .pr-bubble.is-dashed::after { display:none; }
    .pr-bubble-text { display:-webkit-box; -webkit-line-clamp:3; -webkit-box-orient:vertical; overflow:hidden; word-break:break-word; }

    .pr-avatar-wrap { position:relative; }
    .pr-avatar { background:none; border:none; padding:0; cursor:pointer; display:block; -webkit-tap-highlight-color:transparent; }
    .pr-vibe { position:absolute; top:-3px; left:-5px; width:22px; height:22px; border-radius:50%; display:grid; place-items:center; font-size:12px; z-index:2;
      background:var(--dark-bg, #14111f); border:2px solid var(--dark-bg, #14111f); box-shadow:0 2px 6px rgba(0,0,0,.35); }
    .pr-name { margin-top:5px; font-size:11px; font-weight:600; color:var(--dark-muted, rgba(255,255,255,.6)); max-width:74px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }

    .pr-toast { position:fixed; left:50%; bottom:92px; transform:translateX(-50%); z-index:950; display:flex; align-items:center; gap:14px; padding:10px 12px 10px 16px;
      border-radius:999px; background:rgba(24,20,44,.96); color:#f6f4ff; border:1px solid rgba(255,255,255,.14); box-shadow:0 14px 40px rgba(0,0,0,.5);
      font-size:13px; font-weight:600; animation:prToastIn .22s ease both; }
    .pr-toast button { border:none; background:rgba(167,139,250,.22); color:#c4b5fd; font-family:inherit; font-weight:800; font-size:12px; padding:6px 12px; border-radius:999px; cursor:pointer; }

    [data-theme="light"] .pr-bubble { border-color:rgba(108,99,255,.22); }
    [data-theme="light"] .pr-bubble::after { border-color:rgba(108,99,255,.22); }
    @media (prefers-reduced-motion: reduce) { .pr-bubble.is-pop, .pr-toast { animation:none; } .pr-bubble, .pr-bubble:hover { transition:none; } }
  `
  document.head.appendChild(el)
}
