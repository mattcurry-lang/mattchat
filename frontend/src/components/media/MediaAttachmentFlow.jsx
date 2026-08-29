// MediaAttachmentFlow.jsx
// Owns which picker/composer is open and calls sendMediaMessage for you.
// Photos and videos now route through MediaComposer for editing before
// send; documents and audio skip straight to sendMediaMessage since the
// spec doesn't call for editing those.

import { useState, useImperativeHandle, forwardRef } from 'react'
import MediaStudio from './MediaStudio'
import MediaPicker from './MediaPicker'
import CameraCapture from './CameraCapture'
import FilePicker from './FilePicker'
import MediaComposer from './MediaComposer'

const MediaAttachmentFlow = forwardRef(function MediaAttachmentFlow({ sendMediaMessage }, ref) {
  const [studioOpen, setStudioOpen] = useState(false)
  const [activePicker, setActivePicker] = useState(null) // 'photos' | 'camera' | 'documents' | 'audio' | null
  const [composerItems, setComposerItems] = useState(null) // [{ file, mediaType }] | null

  useImperativeHandle(ref, () => ({
    open: () => setStudioOpen(true),
  }))

  const handleSelectOption = (id) => {
    if (id === 'photos' || id === 'videos') setActivePicker('photos')
    else if (id === 'camera') setActivePicker('camera')
    else if (id === 'documents') setActivePicker('documents')
    else if (id === 'audio') setActivePicker('audio')
    // 'location', 'contact', 'moment' are separate flows not built yet.
  }

  // Photos/videos from MediaPicker or CameraCapture go into the Composer
  // instead of straight to sendMediaMessage.
  const handlePickedForEditing = (files, mediaType) => {
    setActivePicker(null)
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
  }

  return (
    <>
      <MediaStudio
        isOpen={studioOpen}
        onClose={() => setStudioOpen(false)}
        onSelectOption={handleSelectOption}
      />

      <MediaPicker
        isOpen={activePicker === 'photos'}
        onClose={() => setActivePicker(null)}
        onConfirm={handlePickedForEditing}
        accept="image/*,video/*"
      />

      <CameraCapture
        isOpen={activePicker === 'camera'}
        onClose={() => setActivePicker(null)}
        onConfirm={handlePickedForEditing}
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
        onCancel={() => setComposerItems(null)}
        onSend={handleComposerSend}
      />
    </>
  )
})

export default MediaAttachmentFlow
