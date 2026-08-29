// MediaAttachmentFlow.jsx
// Owns which picker/composer is open and calls sendMediaMessage /
// sendMomentMessage for you. Photos and videos route through
// MediaComposer for editing before send; documents and audio skip
// straight to sendMediaMessage since the spec doesn't call for editing
// those.
//
// Phase 6 addition: desktop/PWA drag-and-drop. DropZone listens at the
// window level whenever a real conversation is open and hands back raw
// dropped files; this file classifies them by MIME type and routes each
// into the same picker pathways a manual selection would use — images/
// video into MediaComposer, documents/audio straight to send.
// Unsupported types are reported via a single alert rather than silently
// dropped, matching FilePicker/MediaPicker's existing validation-error UX.
//
// Section 1 additions: Location, Contact, and Screenshot studio entries.
// Section 5 addition: an explicit "Create Moment" studio entry — forces
// the picker into moment-intent mode so MediaComposer defaults to
// grouping the batch into a Moment instead of sending items separately.

import { useState, useImperativeHandle, forwardRef } from 'react'
import MediaStudio from './MediaStudio'
import MediaPicker from './MediaPicker'
import CameraCapture from './CameraCapture'
import FilePicker from './FilePicker'
import MediaComposer from './MediaComposer'
import DropZone from './DropZone'
import LocationShareModal from './LocationShareModal'
import ContactShareModal from './ContactShareModal'
import ScreenshotCapture from './ScreenshotCapture'
import { validateFile, MediaValidationError } from '../../services/MediaAssetService'

function classifyDroppedFile(file) {
  // Dropped GIFs are tagged 'image' (not 'gif') so they flow through
  // MediaComposer's image branch rather than its video branch — the
  // composer only distinguishes image vs video today. MediaAssetService's
  // ALLOWED_MIME.image list already includes image/gif, so validation
  // still passes; media_assets.media_type still ends up 'image', which is
  // consistent with how a manually-picked GIF also renders fine as a
  // plain image bubble.
  if (file.type.startsWith('image/')) return 'image'
  if (file.type.startsWith('video/')) return 'video'
  if (file.type.startsWith('audio/')) return 'audio'
  const DOCUMENT_MIME = new Set([
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain',
    'text/csv',
    'application/zip',
  ])
  return DOCUMENT_MIME.has(file.type) ? 'document' : null
}

const MediaAttachmentFlow = forwardRef(function MediaAttachmentFlow(
  { sendMediaMessage, sendMomentMessage, onShareLocation, onShareContact, currentUserId },
  ref
) {
  const [studioOpen, setStudioOpen] = useState(false)
  const [activePicker, setActivePicker] = useState(null) // 'photos' | 'camera' | 'documents' | 'audio' | 'screenshot' | null
  const [pickerMomentIntent, setPickerMomentIntent] = useState(false)
  const [composerItems, setComposerItems] = useState(null) // [{ file, mediaType }] | null
  const [composerMomentIntent, setComposerMomentIntent] = useState(false)
  const [locationShareOpen, setLocationShareOpen] = useState(false)
  const [contactShareOpen, setContactShareOpen] = useState(false)

  useImperativeHandle(ref, () => ({
    open: () => setStudioOpen(true),
  }))

  const handleSelectOption = (id) => {
    if (id === 'photos' || id === 'videos') { setPickerMomentIntent(false); setActivePicker('photos') }
    else if (id === 'camera') setActivePicker('camera')
    else if (id === 'documents') setActivePicker('documents')
    else if (id === 'audio') setActivePicker('audio')
    else if (id === 'location') setLocationShareOpen(true)
    else if (id === 'contact') setContactShareOpen(true)
    else if (id === 'screenshot') setActivePicker('screenshot')
    else if (id === 'moment') { setPickerMomentIntent(true); setActivePicker('photos') }
  }

  // MediaPicker hands back a single ordered [{ file, mediaType }] array
  // (mixed photo+video included) — see the Section 5/1 fix that made
  // MediaPicker.handleContinue call onConfirm once instead of once per
  // mediaType.
  const handlePickerConfirm = (orderedItems) => {
    const wasMomentIntent = pickerMomentIntent
    setActivePicker(null)
    setPickerMomentIntent(false)
    setComposerMomentIntent(wasMomentIntent)
    setComposerItems(orderedItems)
  }

  // Camera/Screenshot only ever produce one item of one type — keep the
  // simpler (files, mediaType) shape for these rather than forcing them
  // through the ordered-array shape MediaPicker uses.
  const handleSingleTypeConfirm = (files, mediaType) => {
    setActivePicker(null)
    setComposerMomentIntent(false)
    setComposerItems(files.map(file => ({ file, mediaType })))
  }

  // Documents/audio skip editing entirely.
  const handlePickedDirect = (files, mediaType) => {
    sendMediaMessage(files, { mediaType })
    setActivePicker(null)
  }

  const handleComposerSend = (files, mediaType, opts) => {
    sendMediaMessage(files, { mediaType, ...opts })
    setComposerItems(null)
    setComposerMomentIntent(false)
  }

  const handleComposerSendMoment = (items, opts) => {
    sendMomentMessage(items, opts)
    setComposerItems(null)
    setComposerMomentIntent(false)
  }

  const handleLocationConfirm = (coords) => {
    setLocationShareOpen(false)
    setStudioOpen(false)
    onShareLocation?.(coords)
  }

  const handleContactConfirm = (profile) => {
    setContactShareOpen(false)
    setStudioOpen(false)
    onShareContact?.(profile)
  }

  // ---- drag-and-drop entry point (spec section 6) ----
  // A single drop can mix types (e.g. two photos + a PDF at once) — group
  // by destination rather than assuming one type per drop like the pickers
  // do, then route each group the same way a manual pick of that type
  // would be routed.
  const handleFilesDropped = (files) => {
    const composerBound = [] // -> MediaComposer
    const directByType = {}  // mediaType -> File[] -> straight to sendMediaMessage
    const rejected = []

    for (const file of files) {
      const mediaType = classifyDroppedFile(file)
      if (!mediaType) { rejected.push(`${file.name} (unsupported file type)`); continue }
      try {
        validateFile(file, mediaType)
      } catch (e) {
        if (e instanceof MediaValidationError) { rejected.push(`${file.name} (${e.message})`); continue }
        throw e
      }
      if (mediaType === 'image' || mediaType === 'video') {
        composerBound.push({ file, mediaType })
      } else {
        directByType[mediaType] = directByType[mediaType] || []
        directByType[mediaType].push(file)
      }
    }

    if (composerBound.length) { setComposerMomentIntent(false); setComposerItems(composerBound) }
    Object.entries(directByType).forEach(([mediaType, typeFiles]) => sendMediaMessage(typeFiles, { mediaType }))

    if (rejected.length) {
      alert(`Couldn't add ${rejected.length === 1 ? 'this file' : 'these files'}:\n${rejected.join('\n')}`)
    }
  }

  return (
    <>
      <DropZone
        enabled={!studioOpen && !activePicker && !composerItems}
        onFilesDropped={handleFilesDropped}
      />

      <MediaStudio
        isOpen={studioOpen}
        onClose={() => setStudioOpen(false)}
        onSelectOption={handleSelectOption}
      />

      <MediaPicker
        isOpen={activePicker === 'photos'}
        onClose={() => { setActivePicker(null); setPickerMomentIntent(false) }}
        onConfirm={handlePickerConfirm}
        accept="image/*,video/*"
        heading={pickerMomentIntent ? 'Choose media for your Moment' : undefined}
      />
      <CameraCapture
        isOpen={activePicker === 'camera'}
        onClose={() => setActivePicker(null)}
        onConfirm={handleSingleTypeConfirm}
      />
      <ScreenshotCapture
        isOpen={activePicker === 'screenshot'}
        onClose={() => setActivePicker(null)}
        onConfirm={handleSingleTypeConfirm}
      />
      <FilePicker
        isOpen={activePicker === 'documents'}
        onClose={() => setActivePicker(null)}
        onConfirm={handlePickedDirect}
        kind="document"
      />
      <FilePicker
        isOpen={activePicker === 'audio'}
        onClose={() => setActivePicker(null)}
        onConfirm={handlePickedDirect}
        kind="audio"
      />
      <MediaComposer
        isOpen={!!composerItems}
        items={composerItems || []}
        momentIntent={composerMomentIntent}
        onCancel={() => { setComposerItems(null); setComposerMomentIntent(false) }}
        onSend={handleComposerSend}
        onSendMoment={handleComposerSendMoment}
      />

      <LocationShareModal
        isOpen={locationShareOpen}
        onClose={() => setLocationShareOpen(false)}
        onConfirm={handleLocationConfirm}
      />
      <ContactShareModal
        isOpen={contactShareOpen}
        onClose={() => setContactShareOpen(false)}
        onConfirm={handleContactConfirm}
        currentUserId={currentUserId}
      />
    </>
  )
})

export default MediaAttachmentFlow
