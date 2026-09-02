// MediaComposer.jsx
// Sits between selection (MediaPicker/CameraCapture) and send. Edits are
// real, not cosmetic previews:
//   - Photos: rotate (90° steps), drag-crop with aspect presets, brightness/
//     contrast/saturation (canvas `ctx.filter`, so preview == export), and
//     Markup (delegates to MarkupEditor, whose flattened output becomes the
//     authoritative image for that item).
//   - Videos: real client-side trim + speed change, done by re-recording the
//     trimmed range through <video>.captureStream() + MediaRecorder (no
//     ffmpeg dependency). Mute drops the audio track from the recorded
//     stream. Thumbnail selection captures a real frame as a JPEG blob.
// Quality (HD/Standard/Compressed) controls export resolution/bitrate for
// both.
//
// onSend is called once per media type with the FINAL File objects, in the
// same shape sendMediaMessage expects: onSend(files, mediaType, { caption }).
// Video sends also get a companion thumbnail Blob array per file via
// onSend(files, mediaType, { caption, thumbnails: Blob[] }).
//
// Phase 4 addition: when there's more than one item, a "Create Moment" pill
// appears (or, under momentIntent, is the default primary action). It runs
// the SAME export pipeline as a normal send (so crop/filter/trim/markup
// edits are honored) but hands the exported files to MomentComposer instead
// of sending immediately, so the user can title, reorder, and pick a cover
// before it goes out as one grouped message via onSendMoment.
//
// Defensive fix: current?.file is guarded everywhere it's read — a
// malformed item (missing file) now logs a console.error and closes the
// composer instead of crashing the whole render with
// "Cannot read properties of undefined (reading 'name')".
//
// STYLE PASS (aligned with MediaStudio/MediaPicker): swapped the emoji
// glyphs (rotate arrows, sparkle, camera) for the same SVG-icon approach
// used in those two files, and unified the accent color onto the
// #7F5FFF -> #C86DD7 gradient established there. Purely cosmetic — no
// editing/export logic below was touched.

import { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import MarkupEditor from './MarkupEditor'
import MomentComposer from './MomentComposer'
import { IconX, IconBrush, IconSparkle, IconCamera } from '../Icons'

// View-once toggle icons — not in the shared Icons file.
const IconEye = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" stroke="currentColor" strokeWidth={1.8} strokeLinejoin="round" />
    <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth={1.8} />
  </svg>
)
const IconOne = ({ size = 12 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <path d="M10 7l4-2v14" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

// Rotate icons aren't in the shared Icons file — same self-contained
// approach MediaPicker used for icons outside that set.
const IconRotateCCW = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <path d="M4 9a8 8 0 1 1 1.5 6.7" stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
    <path d="M4 4v5h5" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)
const IconRotateCW = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <path d="M20 9a8 8 0 1 0-1.5 6.7" stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
    <path d="M20 4v5h-5" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

const QUALITY_PRESETS = {
  hd: { maxDim: 1920, imageQuality: 0.92, videoBitrate: 6_000_000, label: 'HD' },
  standard: { maxDim: 1280, imageQuality: 0.82, videoBitrate: 2_500_000, label: 'Standard' },
  compressed: { maxDim: 720, imageQuality: 0.6, videoBitrate: 800_000, label: 'Compressed' },
}

const ASPECTS = { Free: null, Square: 1, '4:3': 4 / 3, '16:9': 16 / 9 }

function defaultEditState(mediaType, duration = 0) {
  return mediaType === 'video'
    ? { trimStart: 0, trimEnd: duration, muted: false, speed: 1, thumbnailTime: 0, thumbnailBlob: null }
    : { rotation: 0, crop: null, brightness: 100, contrast: 100, saturation: 100, markupCanvas: null, aspect: 'Free' }
}

export default function MediaComposer({ isOpen, items, momentIntent = false, onCancel, onSend, onSendMoment }) {
  const [index, setIndex] = useState(0)
  const [edits, setEdits] = useState({}) // itemId -> edit state
  const [quality, setQuality] = useState('standard')
  const [caption, setCaption] = useState('')
  const [markupOpen, setMarkupOpen] = useState(false)
  const [sending, setSending] = useState(false)
  const [cropDrag, setCropDrag] = useState(null) // { startX, startY }
  // View-once — WhatsApp/Instagram convention: single item only, not
  // batches, not Moments (a grouped "view once" album has no clean
  // semantics — does each photo burn individually, or does opening any
  // one burn the whole set? Left out rather than guessed at).
  const [viewOnce, setViewOnce] = useState(false)

  const [momentOpen, setMomentOpen] = useState(false)
  const [momentItems, setMomentItems] = useState(null)

  // Reset per-open state — viewOnce shouldn't leak from one send to the
  // next composer session.
  useEffect(() => {
    if (isOpen) { setViewOnce(false); setIndex(0) }
  }, [isOpen])

  const imgRef = useRef(null)
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const imageObjRef = useRef(null)
  const markupRef = useRef(null)

  const current = items[index]
  // Guarded against current existing but missing .file — a malformed
  // item used to make currentId `${undefined.name}...` and throw before
  // this component could even log which item was bad.
  const currentId = current?.file ? `${current.file.name}-${index}` : null
  const state = currentId ? (edits[currentId] || defaultEditState(current.mediaType)) : null

  // View-once is only offered for a genuine single-item, non-Moment send.
  const eligibleForViewOnce = items.length === 1 && !momentIntent

  const updateState = useCallback((patch) => {
    setEdits(prev => ({ ...prev, [currentId]: { ...(prev[currentId] || defaultEditState(current.mediaType)), ...patch } }))
  }, [currentId, current])

  // Load image + seed initial crop once per item
  useEffect(() => {
    if (!current?.file || current.mediaType !== 'image') return
    const img = new Image()
    img.onload = () => {
      imageObjRef.current = img
      if (!edits[currentId]?.crop) {
        updateState({ crop: { x: 0, y: 0, w: img.naturalWidth, h: img.naturalHeight } })
      }
      renderPreview()
    }
    img.src = URL.createObjectURL(current.file)
    return () => URL.revokeObjectURL(img.src)
     
  }, [currentId])

  useEffect(() => {
    if (current?.mediaType === 'video' && videoRef.current) {
      const v = videoRef.current
      const onMeta = () => {
        if (!edits[currentId]) updateState({ trimEnd: v.duration })
      }
      v.addEventListener('loadedmetadata', onMeta)
      return () => v.removeEventListener('loadedmetadata', onMeta)
    }
    
  }, [currentId])

  const filterString = (s) => `brightness(${s.brightness}%) contrast(${s.contrast}%) saturate(${s.saturation}%)`

  function renderPreview() {
    if (!current?.file || current.mediaType !== 'image' || !imageObjRef.current || !canvasRef.current) return
    const s = edits[currentId] || defaultEditState('image')
    const img = imageObjRef.current
    const canvas = canvasRef.current
    const rotated90 = s.rotation % 180 !== 0
    const dispW = rotated90 ? img.naturalHeight : img.naturalWidth
    const dispH = rotated90 ? img.naturalWidth : img.naturalHeight
    canvas.width = dispW
    canvas.height = dispH
    const ctx = canvas.getContext('2d')
    ctx.save()
    ctx.filter = filterString(s)
    ctx.translate(dispW / 2, dispH / 2)
    ctx.rotate((s.rotation * Math.PI) / 180)
    ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2)
    ctx.restore()
  }

  useEffect(renderPreview, [state?.rotation, state?.brightness, state?.contrast, state?.saturation])  

  const rotate = (dir) => updateState({ rotation: ((state.rotation + (dir * 90)) % 360 + 360) % 360 })

  const setAspect = (name) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ratio = ASPECTS[name]
    let { w, h } = { w: canvas.width, h: canvas.height }
    if (ratio) {
      if (w / h > ratio) w = h * ratio
      else h = w / ratio
    }
    updateState({ aspect: name, crop: { x: (canvas.width - w) / 2, y: (canvas.height - h) / 2, w, h } })
  }

  // ---- crop drag (corner handles, normalized against the rendered <canvas> box) ----
  const cropBoxStyle = () => {
    const canvas = canvasRef.current
    if (!canvas || !state?.crop) return {}
    return {
      left: `${(state.crop.x / canvas.width) * 100}%`,
      top: `${(state.crop.y / canvas.height) * 100}%`,
      width: `${(state.crop.w / canvas.width) * 100}%`,
      height: `${(state.crop.h / canvas.height) * 100}%`,
    }
  }

  const dragCorner = (corner) => (e) => {
    e.stopPropagation()
    e.preventDefault()
    const canvas = canvasRef.current
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    const ratio = ASPECTS[state.aspect]

    const onMove = (moveEv) => {
      const clientX = moveEv.touches ? moveEv.touches[0].clientX : moveEv.clientX
      const clientY = moveEv.touches ? moveEv.touches[0].clientY : moveEv.clientY
      const px = (clientX - rect.left) * scaleX
      const py = (clientY - rect.top) * scaleY
      setEdits(prev => {
        const s = prev[currentId]
        let { x, y, w, h } = s.crop
        if (corner === 'br') { w = Math.max(20, px - x); h = ratio ? w / ratio : Math.max(20, py - y) }
        if (corner === 'tl') {
          const newW = Math.max(20, (x + w) - px)
          const newH = ratio ? newW / ratio : Math.max(20, (y + h) - py)
          x = (x + w) - newW; y = (y + h) - newH; w = newW; h = newH
        }
        return { ...prev, [currentId]: { ...s, crop: { x, y, w, h } } }
      })
    }
    const onUp = () => {
      window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp)
      window.removeEventListener('touchmove', onMove); window.removeEventListener('touchend', onUp)
    }
    window.addEventListener('mousemove', onMove); window.addEventListener('mouseup', onUp)
    window.addEventListener('touchmove', onMove); window.addEventListener('touchend', onUp)
  }

  // ---- markup ----
  const openMarkup = () => setMarkupOpen(true)
  const handleMarkupDone = (mergedCanvas) => {
    updateState({ markupCanvas: mergedCanvas })
    setMarkupOpen(false)
  }

  // ---- video thumbnail capture ----
  const captureThumbnail = () => {
    const v = videoRef.current
    if (!v) return
    const canvas = document.createElement('canvas')
    canvas.width = v.videoWidth; canvas.height = v.videoHeight
    canvas.getContext('2d').drawImage(v, 0, 0)
    canvas.toBlob((blob) => updateState({ thumbnailBlob: blob, thumbnailTime: v.currentTime }), 'image/jpeg', 0.85)
  }

  // ---- export ----
  // (Only one exportImage now — the earlier no-thumbnail duplicate that
  // used to shadow this one has been removed.)
  async function exportImage(item, s, preset) {
    let sourceCanvas
    if (s.markupCanvas) {
      sourceCanvas = s.markupCanvas
    } else {
      const crop = s.crop
      sourceCanvas = document.createElement('canvas')
      sourceCanvas.width = crop.w; sourceCanvas.height = crop.h
      const ctx = sourceCanvas.getContext('2d')
      ctx.filter = filterString(s)
      ctx.drawImage(canvasRef.current, crop.x, crop.y, crop.w, crop.h, 0, 0, crop.w, crop.h)
    }
    const scale = Math.min(1, preset.maxDim / Math.max(sourceCanvas.width, sourceCanvas.height))
    const out = document.createElement('canvas')
    out.width = sourceCanvas.width * scale
    out.height = sourceCanvas.height * scale
    out.getContext('2d').drawImage(sourceCanvas, 0, 0, out.width, out.height)
    const blob = await new Promise(res => out.toBlob(res, 'image/jpeg', preset.imageQuality))
    const file = new File([blob], item.file.name.replace(/\.\w+$/, '.jpg'), { type: 'image/jpeg' })

    // Thumbnail: always generated from the same edited sourceCanvas (crop/
    // rotate/filter/markup already baked in), downscaled small and
    // compressed hard — this is the "thumbnail-first loading" asset from
    // spec sections 12/20, distinct from the full-quality exported file.
    const THUMB_MAX_DIM = 400
    const thumbScale = Math.min(1, THUMB_MAX_DIM / Math.max(sourceCanvas.width, sourceCanvas.height))
    const thumbCanvas = document.createElement('canvas')
    thumbCanvas.width = sourceCanvas.width * thumbScale
    thumbCanvas.height = sourceCanvas.height * thumbScale
    thumbCanvas.getContext('2d').drawImage(sourceCanvas, 0, 0, thumbCanvas.width, thumbCanvas.height)
    const thumbnail = await new Promise(res => thumbCanvas.toBlob(res, 'image/jpeg', 0.6))

    return { file, thumbnail }
  }
// ---- video export (trim + speed + mute, re-recorded via captureStream) ----
async function exportVideo(item, s, preset) {
  return new Promise((resolve, reject) => {
    const src = document.createElement('video')
    src.muted = true // element playback is always muted; audio is captured via the stream itself, gated below
    src.playsInline = true
    src.src = URL.createObjectURL(item.file)

    src.onerror = () => reject(new Error('[MediaComposer] exportVideo: failed to load source video'))

    src.onloadedmetadata = async () => {
      try {
        src.currentTime = s.trimStart
        await new Promise(res => { src.onseeked = res })

        const stream = src.captureStream ? src.captureStream() : src.mozCaptureStream?.()
        if (!stream) throw new Error('captureStream unsupported in this browser')
        if (s.muted) stream.getAudioTracks().forEach(t => stream.removeTrack(t))

        const recorder = new MediaRecorder(stream, {
          mimeType: 'video/webm;codecs=vp9,opus',
          videoBitsPerSecond: preset.videoBitrate,
        })
        const chunks = []
        recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data) }
        recorder.onerror = (e) => reject(e.error || e)
        recorder.onstop = () => {
          URL.revokeObjectURL(src.src)
          const blob = new Blob(chunks, { type: 'video/webm' })
          resolve(new File([blob], item.file.name.replace(/\.\w+$/, '.webm'), { type: 'video/webm' }))
        }

        src.playbackRate = s.speed || 1
        recorder.start()
        await src.play()

        const stop = () => { if (recorder.state === 'recording') { src.pause(); recorder.stop() } }
        const watch = () => {
          if (src.currentTime >= s.trimEnd || src.paused || src.ended) stop()
          else requestAnimationFrame(watch)
        }
        requestAnimationFrame(watch)

        // Safety net in case currentTime polling misses the boundary
        const trimDurationMs = ((s.trimEnd - s.trimStart) / (s.speed || 1)) * 1000
        setTimeout(stop, trimDurationMs + 1500)
      } catch (err) {
        reject(err)
      }
    }
  })
}
  // Shared by both plain send and Create Moment — runs every item through
  // its full edit pipeline (crop/rotate/filter/markup for images, trim/
  // speed/mute for video) and returns [{ file, mediaType, thumbnail }] in
  // original item order. Malformed items (missing .file) are logged and
  // skipped rather than throwing and killing the whole export.
  async function exportAllItems() {
    const preset = QUALITY_PRESETS[quality]
    const results = []
    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      if (!item?.file) {
        console.error('[MediaComposer] exportAllItems: item missing file at index', i, item)
        continue
      }
      const id = `${item.file.name}-${i}`
      const s = edits[id] || defaultEditState(item.mediaType)

      if (item.mediaType === 'image') {
        // ensure canvas reflects THIS item before exporting (renderPreview
        // only tracks the currently-viewed index) — cheap to redo here.
        if (i !== index) {
          const img = new Image()
          await new Promise(res => { img.onload = res; img.src = URL.createObjectURL(item.file) })
          const tmp = document.createElement('canvas')
          const rotated90 = s.rotation % 180 !== 0
          tmp.width = rotated90 ? img.naturalHeight : img.naturalWidth
          tmp.height = rotated90 ? img.naturalWidth : img.naturalHeight
          const tctx = tmp.getContext('2d')
          tctx.filter = filterString(s)
          tctx.translate(tmp.width / 2, tmp.height / 2)
          tctx.rotate((s.rotation * Math.PI) / 180)
          tctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2)
          canvasRef.current.width = tmp.width; canvasRef.current.height = tmp.height
          canvasRef.current.getContext('2d').drawImage(tmp, 0, 0)
        }
        const { file: imgFile, thumbnail: imgThumb } = await exportImage(item, s, preset)
        results.push({ file: imgFile, mediaType: 'image', thumbnail: imgThumb })
      } else if (item.mediaType === 'video') {
        results.push({ file: await exportVideo(item, s, preset), mediaType: 'video', thumbnail: s.thumbnailBlob || null })
      }
    }
    return results
  }

  const handleSend = async () => {
    setSending(true)
    try {
      const results = await exportAllItems()
      const byType = { image: [], video: [] }
      const imageThumbnails = []
      const videoThumbnails = []
      results.forEach(r => {
        byType[r.mediaType].push(r.file)
        if (r.mediaType === 'image') imageThumbnails.push(r.thumbnail || null)
        if (r.mediaType === 'video') videoThumbnails.push(r.thumbnail || null)
      })
      if (byType.image.length) onSend(byType.image, 'image', { caption: caption.trim() || null, thumbnails: imageThumbnails, viewOnce: eligibleForViewOnce ? viewOnce : false })
      if (byType.video.length) onSend(byType.video, 'video', { caption: caption.trim() || null, thumbnails: videoThumbnails, viewOnce: eligibleForViewOnce ? viewOnce : false })
    } catch (e) {
      console.error('[MediaComposer] export failed:', e)
      alert('Something went wrong preparing that media — please try again.')
    }
    setSending(false)
  }

  const handleCreateMoment = async () => {
    setSending(true)
    try {
      const results = await exportAllItems()
      setMomentItems(results.map(({ file, mediaType, thumbnail }) => ({ file, mediaType, thumbnail })))
      setMomentOpen(true)
    } catch (e) {
      console.error('[MediaComposer] moment export failed:', e)
      alert('Something went wrong preparing that Moment — please try again.')
    }
    setSending(false)
  }

  const handleMomentSend = (finalItems, opts) => {
    onSendMoment?.(finalItems, opts)
    setMomentOpen(false)
    setMomentItems(null)
  }

  // Guarded against a malformed item (missing .file) reaching render —
  // logs which item and index was bad instead of throwing
  // "Cannot read properties of undefined (reading 'name')" and
  // white-screening the whole app.
  if (!isOpen || !current) return null
  if (!current.file) {
    console.error('[MediaComposer] item missing file at index', index, current)
    return null
  }

  return (
    <AnimatePresence>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={overlayStyle}>
        <div style={topBarStyle}>
          <button onClick={onCancel} style={iconBtnStyle}><IconX size={16} /></button>
          <span style={counterStyle}>{index + 1} / {items.length}</span>
          <button onClick={openMarkup} style={iconBtnStyle} title="Markup" disabled={current.mediaType !== 'image'}>
            <IconBrush size={16} />
          </button>
        </div>

        {momentIntent && items.length > 1 && (
          <div style={momentBannerStyle}>
            <IconSparkle size={13} style={{ verticalAlign: '-2px', marginRight: 5 }} />
            Creating a Moment — {items.length} items
          </div>
        )}

        <div style={stageStyle}>
          {current.mediaType === 'image' ? (
            <div style={{ position: 'relative', maxWidth: '100%', maxHeight: '100%' }}>
              <canvas ref={canvasRef} style={{ maxWidth: '100%', maxHeight: '60vh', display: 'block' }} />
              {state?.crop && (
                <div style={{ position: 'absolute', border: '2px solid #fff', boxShadow: '0 0 0 2000px rgba(0,0,0,0.4)', ...cropBoxStyle() }}>
                  <div onMouseDown={dragCorner('tl')} onTouchStart={dragCorner('tl')} style={{ ...handleStyle, left: -8, top: -8, cursor: 'nwse-resize' }} />
                  <div onMouseDown={dragCorner('br')} onTouchStart={dragCorner('br')} style={{ ...handleStyle, right: -8, bottom: -8, cursor: 'nwse-resize' }} />
                </div>
              )}
            </div>
          ) : (
            <video ref={videoRef} src={URL.createObjectURL(current.file)} controls muted={state?.muted} style={{ maxWidth: '100%', maxHeight: '60vh' }} />
          )}
        </div>

        <div style={controlsStyle}>
          {current.mediaType === 'image' ? (
            <>
              <div style={rowStyle}>
                <button onClick={() => rotate(-1)} style={pillBtnStyle}>
                  <IconRotateCCW size={13} style={{ verticalAlign: '-2px', marginRight: 5 }} />Rotate
                </button>
                <button onClick={() => rotate(1)} style={pillBtnStyle}>
                  <IconRotateCW size={13} style={{ verticalAlign: '-2px', marginRight: 5 }} />Rotate
                </button>
                {Object.keys(ASPECTS).map(name => (
                  <button key={name} onClick={() => setAspect(name)} style={{ ...pillBtnStyle, background: state?.aspect === name ? ACCENT_GRADIENT : 'rgba(255,255,255,0.08)' }}>{name}</button>
                ))}
              </div>
              <SliderRow label="Brightness" value={state?.brightness ?? 100} onChange={v => updateState({ brightness: v })} min={50} max={150} />
              <SliderRow label="Contrast" value={state?.contrast ?? 100} onChange={v => updateState({ contrast: v })} min={50} max={150} />
              <SliderRow label="Saturation" value={state?.saturation ?? 100} onChange={v => updateState({ saturation: v })} min={0} max={200} />
            </>
          ) : (
            <>
              <div style={rowStyle}>
                <label style={labelStyle}>
                  <input type="checkbox" checked={!!state?.muted} onChange={(e) => updateState({ muted: e.target.checked })} /> Mute
                </label>
                <select value={state?.speed ?? 1} onChange={(e) => updateState({ speed: Number(e.target.value) })} style={selectStyle}>
                  {[0.5, 1, 1.5, 2].map(sp => <option key={sp} value={sp}>{sp}x</option>)}
                </select>
                <button onClick={captureThumbnail} style={pillBtnStyle}>
                  <IconCamera size={13} style={{ verticalAlign: '-2px', marginRight: 5 }} />Use current frame as thumbnail
                </button>
              </div>
              <div style={rowStyle}>
                <span style={labelStyle}>Trim</span>
                <input
                  type="range" min={0} max={videoRef.current?.duration || 0} step={0.1}
                  value={state?.trimStart ?? 0}
                  onChange={(e) => updateState({ trimStart: Math.min(Number(e.target.value), (state?.trimEnd ?? videoRef.current?.duration ?? 0) - 0.2) })}
                  style={{ flex: 1 }}
                />
                <input
                  type="range" min={0} max={videoRef.current?.duration || 0} step={0.1}
                  value={state?.trimEnd ?? (videoRef.current?.duration || 0)}
                  onChange={(e) => updateState({ trimEnd: Math.max(Number(e.target.value), (state?.trimStart ?? 0) + 0.2) })}
                  style={{ flex: 1 }}
                />
              </div>
            </>
          )}

          <div style={rowStyle}>
            {items.length > 1 && (
              <div style={{ display: 'flex', gap: 6, overflowX: 'auto' }}>
                {items.map((it, i) => (
                  <button key={i} onClick={() => setIndex(i)} style={{ ...thumbDotStyle, opacity: i === index ? 1 : 0.4 }} />
                ))}
              </div>
            )}
            {items.length > 1 && !momentIntent && (
              <button
                onClick={handleCreateMoment}
                disabled={sending}
                style={{ ...pillBtnStyle, background: ACCENT_GRADIENT, marginLeft: 'auto', opacity: sending ? 0.6 : 1 }}
              >
                <IconSparkle size={13} style={{ verticalAlign: '-2px', marginRight: 5 }} />Create Moment
              </button>
            )}
          </div>

          {eligibleForViewOnce && (
            <button
              onClick={() => setViewOnce(v => !v)}
              style={{
                ...pillBtnStyle,
                display: 'flex', alignItems: 'center', gap: 6,
                background: viewOnce ? ACCENT_GRADIENT : 'rgba(255,255,255,0.08)',
                alignSelf: 'flex-start',
              }}
              title="Recipient can open this once, then it's gone"
            >
              {viewOnce ? <IconOne size={13} /> : <IconEye size={13} />}
              View once {viewOnce ? '· On' : ''}
            </button>
          )}

          <input
            type="text" value={caption} onChange={(e) => setCaption(e.target.value)}
            placeholder="Add a caption…" style={captionInputStyle}
          />

          <div style={rowStyle}>
            {Object.entries(QUALITY_PRESETS).map(([key, p]) => (
              <button key={key} onClick={() => setQuality(key)} style={{ ...pillBtnStyle, background: quality === key ? ACCENT_GRADIENT : 'rgba(255,255,255,0.08)' }}>
                {p.label}
              </button>
            ))}
          </div>

          <button
            onClick={momentIntent && items.length > 1 ? handleCreateMoment : handleSend}
            disabled={sending}
            style={sendBtnStyle}
          >
            {sending
              ? 'Preparing…'
              : momentIntent && items.length > 1
                ? `Create Moment (${items.length})`
                : eligibleForViewOnce && viewOnce
                  ? 'Send (View once)'
                  : `Send${items.length > 1 ? ` ${items.length}` : ''}`}
          </button>
          {momentIntent && items.length > 1 && (
            <button onClick={handleSend} disabled={sending} style={sendAsSeparateLinkStyle}>
              Send as separate messages instead
            </button>
          )}
        </div>

        {markupOpen && current.mediaType === 'image' && (
          <MarkupEditor
            ref={markupRef}
            baseImage={state.markupCanvas || canvasRef.current}
            width={canvasRef.current?.width || 800}
            height={canvasRef.current?.height || 600}
            onClose={() => setMarkupOpen(false)}
            onDone={handleMarkupDone}
          />
        )}

        {momentOpen && (
          <MomentComposer
            isOpen={momentOpen}
            items={momentItems || []}
            onCancel={() => { setMomentOpen(false); setMomentItems(null) }}
            onSend={handleMomentSend}
          />
        )}
      </motion.div>
    </AnimatePresence>
  )
}

function SliderRow({ label, value, onChange, min, max }) {
  return (
    <div style={rowStyle}>
      <span style={{ ...labelStyle, width: 80 }}>{label}</span>
      <input type="range" min={min} max={max} value={value} onChange={(e) => onChange(Number(e.target.value))} style={{ flex: 1 }} />
    </div>
  )
}

// Same brand gradient as MediaStudio/MediaPicker's primary actions —
// hardcoded (not a theme var) since this overlay is always a fixed black
// surface (see overlayStyle) regardless of app theme.
const ACCENT_GRADIENT = 'linear-gradient(135deg, #7F5FFF 0%, #C86DD7 100%)'
const ACCENT_SOLID = '#7F5FFF'

const overlayStyle = { position: 'fixed', inset: 0, zIndex: 80, display: 'flex', flexDirection: 'column', background: '#000' }
const topBarStyle = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px' }
const counterStyle = { color: '#fff', fontWeight: 600, fontSize: 13 }
const iconBtnStyle = { width: 36, height: 36, borderRadius: '50%', background: 'rgba(255,255,255,0.1)', color: '#fff', border: 'none', cursor: 'pointer' }
const stageStyle = { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }
const handleStyle = { position: 'absolute', width: 20, height: 20, background: '#fff', borderRadius: '50%', border: `2px solid ${ACCENT_SOLID}` }
const controlsStyle = { background: 'rgba(15,13,22,0.96)', padding: '12px 16px max(12px, env(safe-area-inset-bottom))', display: 'flex', flexDirection: 'column', gap: 10 }
const rowStyle = { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }
const labelStyle = { color: 'rgba(255,255,255,0.75)', fontSize: 12.5, display: 'flex', alignItems: 'center', gap: 6 }
const pillBtnStyle = { padding: '7px 12px', borderRadius: 20, border: 'none', background: 'rgba(255,255,255,0.08)', color: '#fff', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }
const selectStyle = { background: 'rgba(255,255,255,0.08)', color: '#fff', border: 'none', borderRadius: 10, padding: '7px 10px', fontSize: 12.5 }
const thumbDotStyle = { width: 8, height: 8, borderRadius: '50%', background: '#fff', border: 'none', cursor: 'pointer', flexShrink: 0 }
const captionInputStyle = { background: 'rgba(255,255,255,0.08)', border: 'none', borderRadius: 12, padding: '10px 14px', color: '#fff', fontSize: 14 }
const sendBtnStyle = { background: ACCENT_GRADIENT, color: '#fff', border: 'none', borderRadius: 14, padding: '13px 0', fontWeight: 700, fontSize: 15, cursor: 'pointer' }
const momentBannerStyle = { textAlign: 'center', color: '#c4b5fd', fontSize: 12, fontWeight: 700, padding: '2px 16px 8px' }
const sendAsSeparateLinkStyle = { background: 'none', border: 'none', color: 'rgba(255,255,255,0.55)', fontSize: 12, textAlign: 'center', textDecoration: 'underline', cursor: 'pointer', padding: '2px 0 0', fontFamily: 'inherit' }
