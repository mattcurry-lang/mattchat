import Avatar from './Avatar'

/*
 * Small UI pieces that show what people have set on their profile.
 * All of them take `extras` from usePublicProfiles(...).get(userId) and render nothing when there is nothing to show.
 */

// A tiny emoji on the corner of an avatar. The parent must be position: relative.
// It sits bottom-left so it does not collide with the online dot; move it if your layout differs.
export function StatusBadge({ extras, size = 18 }) {
  const emoji = extras?.statusEmoji || (extras?.statusText ? '💭' : '')
  if (!emoji) return null
  return (
    <span
      title={extras.statusText || undefined}
      aria-label={extras.statusText ? `Status: ${extras.statusText}` : 'Has a status'}
      style={{
        position: 'absolute', left: -3, bottom: -3, width: size, height: size, borderRadius: '50%',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: size * 0.6, lineHeight: 1,
        background: 'var(--bg-surface-1, #0f0f1a)', border: '1px solid var(--dark-border, rgba(255,255,255,0.14))',
      }}
    >
      {emoji}
    </span>
  )
}

// " · 📚 Studying" appended to a line of small text, such as the chat header's sub line.
export function StatusLine({ extras }) {
  if (!extras || (!extras.statusEmoji && !extras.statusText)) return null
  return (
    <>
      <span aria-hidden="true"> · </span>
      <span
        style={{
          display: 'inline-block', maxWidth: 170, overflow: 'hidden', textOverflow: 'ellipsis',
          whiteSpace: 'nowrap', verticalAlign: 'bottom',
        }}
      >
        {extras.statusEmoji || '💭'}{extras.statusText ? ` ${extras.statusText}` : ''}
      </span>
    </>
  )
}

function NoteItem({ name, avatarUrl, note, onClick, own }) {
  const empty = !note
  return (
    <button
      onClick={onClick}
      aria-label={own ? (empty ? 'Add a note' : 'Edit your note') : `${name}'s note: ${note}`}
      style={itemStyle}
    >
      <span style={bubbleStyle(empty)}>
        {empty ? '+ Note' : <span style={noteTextStyle}>{note}</span>}
        {!empty && <span style={tailStyle} />}
      </span>
      <Avatar name={name} photoUrl={avatarUrl} size={52} />
      <span style={labelStyle}>{own ? 'Your note' : (name || 'Unknown').split(' ')[0]}</span>
    </button>
  )
}

/*
 * Instagram-style notes: a short thought above each contact's avatar for 24 hours.
 * Only shows when at least one contact has an active note. Tapping a contact opens the chat.
 *
 * Props:
 *   conversations, userId, extras (usePublicProfiles result)
 *   getOtherId(convo, userId), getAvatar(convo, userId), getName(convo)
 *   myName, myAvatar
 *   onOpenConversation(convo), onEditMyNote()
 */
export function NotesRail({
  conversations, userId, extras, getOtherId, getAvatar, getName,
  myName, myAvatar, onOpenConversation, onEditMyNote,
}) {
  const items = []
  for (const c of conversations || []) {
    if (c.is_group || c.isCurryAI) continue
    const otherId = getOtherId(c, userId)
    const ex = otherId ? extras.get(otherId) : null
    if (ex?.note) items.push({ convo: c, ex })
  }
  if (items.length === 0) return null

  // a later expiry means a newer note (notes live for 24 hours)
  items.sort((a, b) => new Date(b.ex.noteExpiresAt) - new Date(a.ex.noteExpiresAt))
  const mine = extras.get(userId)

  return (
    <div role="list" aria-label="Notes from your contacts" style={railStyle}>
      <NoteItem own name={myName || 'You'} avatarUrl={myAvatar} note={mine?.note || ''} onClick={onEditMyNote} />
      {items.map(({ convo, ex }) => (
        <NoteItem
          key={convo.id}
          name={getName(convo)}
          avatarUrl={getAvatar(convo, userId)}
          note={ex.note}
          onClick={() => onOpenConversation(convo)}
        />
      ))}
    </div>
  )
}

const railStyle = { display: 'flex', gap: 14, overflowX: 'auto', padding: '14px 16px 4px', scrollbarWidth: 'none' }
const itemStyle = {
  flexShrink: 0, width: 72, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
  background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: 'inherit',
}
const bubbleStyle = (empty) => ({
  position: 'relative', maxWidth: 72, minHeight: 24, boxSizing: 'border-box',
  padding: '5px 9px', borderRadius: 14, fontSize: 11, fontWeight: 650, lineHeight: 1.25, textAlign: 'center',
  color: empty ? 'var(--dark-text-3, #9d97b5)' : 'var(--dark-text, #f2f0f8)',
  background: empty ? 'transparent' : 'var(--dark-card, #1a1a2a)',
  border: empty ? '1px dashed var(--dark-border, rgba(255,255,255,0.2))' : '1px solid var(--dark-border, rgba(255,255,255,0.12))',
})
const noteTextStyle = {
  display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden', wordBreak: 'break-word',
}
const tailStyle = {
  position: 'absolute', bottom: -5, left: '50%', width: 9, height: 9, marginLeft: -4,
  background: 'var(--dark-card, #1a1a2a)', borderRight: '1px solid var(--dark-border, rgba(255,255,255,0.12))',
  borderBottom: '1px solid var(--dark-border, rgba(255,255,255,0.12))', transform: 'rotate(45deg)',
}
const labelStyle = {
  fontSize: 11, fontWeight: 600, color: 'var(--dark-text-2, #c9c4dd)', maxWidth: 72,
  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
}
