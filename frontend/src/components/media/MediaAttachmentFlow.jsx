// MediaAttachmentFlow.jsx
// Drop this once near your message composer. It owns which picker is open
// and calls sendMediaMessage for you — the composer only needs to render
// <MediaAttachmentFlow sendMediaMessage={sendMediaMessage} /> plus a button
// that calls the exposed `open()` (via ref) or its own onClick to open
// MediaStudio.

import { useState, useImperativeHandle, forwardRef } from 'react'
import MediaStudio from './MediaStudio'
import MediaPicker from './MediaPicker'
import CameraCapture from './CameraCapture'
import FilePicker from './FilePicker'

const MediaAttachmentFlow = forwardRef(function MediaAttachmentFlow({ sendMediaMessage }, ref) {
  const [studioOpen, setStudioOpen] = useState(false)
  const [activePicker, setActivePicker] = useState(null) // 'photos' | 'camera' | 'documents' | 'audio' | null

  useImperativeHandle(ref, () => ({
    open: () => setStudioOpen(true),
  }))

  const handleSelectOption = (id) => {
    if (id === 'photos' || id === 'videos') setActivePicker('photos')
    else if (id === 'camera') setActivePicker('camera')
    else if (id === 'documents') setActivePicker('documents')
    else if (id === 'audio') setActivePicker('audio')
    // 'location', 'contact', 'moment' are separate flows not built yet
    // (Moments = Phase 4). Wire those up once those components exist.
  }

  const handleConfirm = (files, mediaType) => {
    sendMediaMessage(files, { mediaType })
    setActivePicker(null)
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
        onConfirm={handleConfirm}
        accept="image/*,video/*"
      />

      <CameraCapture
        isOpen={activePicker === 'camera'}
        onClose={() => setActivePicker(null)}
        onConfirm={handleConfirm}
      />

      <FilePicker
        isOpen={activePicker === 'documents'}
        onClose={() => setActivePicker(null)}
        onConfirm={handleConfirm}
        kind="document"
      />

      <FilePicker
        isOpen={activePicker === 'audio'}
        onClose={() => setActivePicker(null)}
        onConfirm={handleConfirm}
        kind="audio"
      />
    </>
  )
})

export default MediaAttachmentFlow
