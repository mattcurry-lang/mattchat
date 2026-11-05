import React, { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { ArtistService } from '../../../lib/music/ArtistService'
import { IconX, IconMic, IconCheck, IconCamera } from '../../Icons'
import './BecomeArtistModal.css'

/**
 * components/Pulse/Music/BecomeArtistModal.jsx
 *
 * Same props as before ({ userId, onClose, onCreated }).
 * A bottom sheet on phones, a centred card on desktop. It shows a live preview of the artist
 * card as you type, so people can see what listeners will see before they commit.
 */

// @pure-start
const NAME_MIN = 2
const NAME_MAX = 40
const BIO_MAX = 160
const PHOTO_MAX_BYTES = 8 * 1024 * 1024

const isImageFile = (f) => !!f && /^image\/(png|jpe?g|webp)$/.test(f.type || '')

function validateName(name) {
  const n = String(name || '').trim()
  if (n.length < NAME_MIN) return `Add your artist name (at least ${NAME_MIN} letters).`
  if (n.length > NAME_MAX) return `Keep it under ${NAME_MAX + 1} characters.`
  return null
}

function validatePhoto(file) {
  if (!isImageFile(file)) return 'Use a PNG, JPG or WebP photo.'
  if (file.size > PHOTO_MAX_BYTES) return 'That photo is over 8 MB. Try a smaller one.'
  return null
}

function initials(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return ''
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase()
}

function friendlyError(e) {
  const m = String(e?.message || e || '')
  if (/duplicate|already|23505/i.test(m)) return 'You already have an artist profile.'
  if (/network|fetch|offline|timeout/i.test(m)) return 'Connection problem. Check your internet and try again.'
  return "Something went wrong. Nothing was saved, so you can try again."
}
// @pure-end

const PERKS = [
  'Goes live the moment you finish',
  'Your music stays yours',
  'Edit or delete anything, anytime',
]

export default function BecomeArtistModal({ userId, onClose, onCreated }) {
  const [artistName, setArtistName] = useState('')
  const [bio, setBio] = useState('')
  const [avatarFile, setAvatarFile] = useState(null)
  const [avatarUrl, setAvatarUrl] = useState(null)
  const [photoError, setPhotoError] = useState(null)
  const [touched, setTouched] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [over, setOver] = useState(false)
  const nameRef = useRef(null)
  const photoInput = useRef(null)

  useEffect(() => { nameRef.current?.focus() }, [])

  useEffect(() => {
    if (!avatarFile) { setAvatarUrl(null); return undefined }
    const url = URL.createObjectURL(avatarFile)
    setAvatarUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [avatarFile])

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape' && !submitting) onClose && onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, submitting])

  const nameProblem = validateName(artistName)
  const showNameProblem = touched && nameProblem

  const takePhoto = (f) => {
    if (!f) return
    const problem = validatePhoto(f)
    if (problem) { setPhotoError(problem); return }
    setPhotoError(null)
    setAvatarFile(f)
  }

  const handleSubmit = async () => {
    setTouched(true)
    if (nameProblem || submitting) { nameRef.current?.focus(); return }
    setSubmitting(true)
    setError(null)
    try {
      const artist = await ArtistService.applyAsArtist(userId, { artistName: artistName.trim(), bio: bio.trim(), avatarFile })
      onCreated(artist)
    } catch (e) {
      console.error('artist signup failed:', e)
      setError(friendlyError(e))
    } finally {
      setSubmitting(false)
    }
  }

  const previewName = artistName.trim() || 'Your artist name'
  const previewBio = bio.trim() || 'Your bio shows up here'

  return (
    <motion.div
      className="ba-backdrop"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      onClick={() => { if (!submitting && onClose) onClose() }}
    >
      <motion.div
        className="ba"
        role="dialog"
        aria-modal="true"
        aria-label="Become a Mattchat Artist"
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 40, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 380, damping: 34 }}
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" className="ba-close" onClick={onClose} disabled={submitting} aria-label="Close"><IconX size={16} /></button>

        <header className="ba-head">
          <span className="ba-badge"><IconMic size={18} /></span>
          <div>
            <h3>Become a Mattchat Artist</h3>
            <p>Takes about a minute. Your profile goes live as soon as you finish.</p>
          </div>
        </header>

        {/* what listeners will see */}
        <div className="ba-preview" aria-label="Preview of your artist card">
          <div
            className={`ba-avatar${over ? ' is-over' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setOver(true) }}
            onDragLeave={() => setOver(false)}
            onDrop={(e) => { e.preventDefault(); setOver(false); takePhoto(e.dataTransfer?.files?.[0]) }}
          >
            {avatarUrl
              ? <img src={avatarUrl} alt="" />
              : artistName.trim() ? <span>{initials(artistName)}</span> : <IconMic size={26} />}
            <button type="button" className="ba-cam" onClick={() => photoInput.current?.click()} disabled={submitting} aria-label={avatarUrl ? 'Change photo' : 'Add a photo'}>
              <IconCamera size={13} />
            </button>
          </div>
          <div className="ba-preview-text">
            <b className={artistName.trim() ? '' : 'is-empty'}>{previewName}</b>
            <span className={bio.trim() ? '' : 'is-empty'}>{previewBio}</span>
            <small>This is how listeners will see you</small>
          </div>
        </div>
        <input ref={photoInput} type="file" hidden accept="image/png,image/jpeg,image/webp" onChange={(e) => { takePhoto(e.target.files?.[0]); e.target.value = '' }} />
        {photoError && <p className="ba-error" role="alert">{photoError}</p>}
        {avatarUrl && !photoError && (
          <button type="button" className="ba-link" onClick={() => setAvatarFile(null)} disabled={submitting}>Remove photo</button>
        )}

        <label className="ba-field">
          <span>Artist name <i>{artistName.trim().length}/{NAME_MAX}</i></span>
          <input
            ref={nameRef}
            value={artistName}
            maxLength={NAME_MAX + 10}
            onChange={(e) => setArtistName(e.target.value)}
            onBlur={() => setTouched(true)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleSubmit() } }}
            placeholder="e.g. DJ Kesh"
            aria-invalid={!!showNameProblem}
            disabled={submitting}
          />
          {showNameProblem && <em className="ba-hint" role="alert">{nameProblem}</em>}
        </label>

        <label className="ba-field">
          <span>Bio <em>(optional)</em> <i>{bio.length}/{BIO_MAX}</i></span>
          <textarea value={bio} rows={3} maxLength={BIO_MAX} onChange={(e) => setBio(e.target.value)} placeholder="One line about your sound" disabled={submitting} />
        </label>

        <ul className="ba-perks">
          {PERKS.map((p) => (
            <li key={p}><span><IconCheck size={11} /></span>{p}</li>
          ))}
        </ul>

        {error && <p className="ba-error" role="alert">{error}</p>}

        <button type="button" className="ba-cta" onClick={handleSubmit} disabled={submitting}>
          {submitting ? 'Setting up your profile…' : 'Start publishing'}
        </button>
        <p className="ba-fine">By publishing, you confirm you have the rights to the music you upload.</p>
      </motion.div>
    </motion.div>
  )
}
