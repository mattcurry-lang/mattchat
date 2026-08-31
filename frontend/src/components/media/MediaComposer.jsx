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
// LAYOUT REDESIGN (this pass): every editing function below — renderPreview,
// rotate, setAspect, cropBoxStyle, dragCorner, captureThumbnail, exportImage,
// exportVideo, exportAllItems, handleSend, handleCreateMoment — is UNCHANGED
// from the previous version. Only the render layer changed: instead of every
// control (rotate/aspect chips/3 sliders, or trim/speed/mute/thumbnail) being
// stacked and always visible at once, the stage is now full-bleed and a
// single-row bottom icon tray opens ONE tool panel at a time as a slide-up
// sheet (the pattern CapCut/Instagram's Edits/Reels editor all converge on).
// New UI-only state: `activeTool` — controls which panel (if any) is open.
// Rotate and "use current frame as thumbnail" stay instant one-tap actions
// (no panel) since there's nothing to configure, matching how those apps
// treat purely-instant actions vs. adjustable ones.

import { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import MarkupEditor from './MarkupEditor'
import MomentComposer from './MomentComposer'
import { IconX, IconBrush, IconSparkle, IconCamera } from '../Icons'

// Self-contained icons (not in the shared Icons file) — same approach
// already used for the rotate icons before this pass.
const IconRotateCCW = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <path d="M4 9a8 8 0 1 1 1.5 6.7" stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
    <path d="M4 4v5h5" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)
const IconRotateCW = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <path d="M20 9a8 8 0 1 0-1.5 6.7" stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
    <path d="M20 4v5h-5" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)
const IconCrop = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <path d="M6 2v14a2 2 0 0 0 2 2h14M18 22V8a2 2 0 0 0-2-2H2" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)
const IconAdjust = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <path d="M4 21V14M4 10V3M12 21v-9M12 8V3M20 21v-6M20 11V3" stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
    <circle cx="4" cy="12" r="2" stroke="currentColor" strokeWidth={2} />
    <circle cx="12" cy="10" r="2" stroke="currentColor" strokeWidth={2} />
    <circle cx="20" cy="13" r="2" stroke="currentColor" strokeWidth={2} />
  </svg>
)
const IconTrim = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <circle cx="6" cy="6" r="3" stroke="currentColor" strokeWidth={2} />
    <circle cx="6" cy="18" r="3" stroke="currentColor" strokeWidth={2} />
    <path d="M20 4L8.12 15.88M14.47 14.48L20 20M8.12 8.12L12 12" stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
  </svg>
)
const IconSpeed = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="13" r="8" stroke="currentColor" strokeWidth={2} />
    <path d="M12 13l3.5-3.5M9 3h6" stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
  </svg>
)
const IconChevronDown = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
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

  // NEW (UI-only): which slide-up tool panel is open, if any.
  // 'crop' | 'adjust' | 'trim' | 'speed' | null
  const [activeTool, setActiveTool] = useState(null)

  const [momentOpen, setMomentOpen] = useState(false)
  const [momentItems, setMomentItems] = useState(null)

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

  const updateState = useCallback((patch) => {
    setEdits(prev => ({ ...prev, [currentId]: { ...(prev[currentId] || defaultEditState(current.mediaType)), ...patch } }))
  }, [currentId, current])

  // Reset the open tool panel whenever the item changes, so switching
  // between a photo and a video doesn't leave e.g. "Trim" open over an image.
  useEffect(() => { setActiveTool(null) }, [currentId])

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
      if (byType.image.length) onSend(byType.image, 'image', { caption: caption.trim() || null, thumbnails: imageThumbnails })
      if (byType.video.length) onSend(byType.video, 'video', { caption: caption.trim() || null, thumbnails: videoThumbnails })
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

  const toggleTool = (id) => setActiveTool(t => (t === id ? null : id))

  return (
    <AnimatePresence>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={overlayStyle}>
        {/* ── Minimal top bar ── */}
        <div style={topBarStyle}>
          <button onClick={onCancel} style={iconBtnStyle}><IconX size={16} /></button>
          <span style={counterStyle}>{index + 1} / {items.length}</span>
          {current.mediaType === 'image' ? (
            <button onClick={openMarkup} style={iconBtnStyle} title="Markup">
              <IconBrush size={16} />
            </button>
          ) : <span style={{ width: 36 }} />}
        </div>

        {momentIntent && items.length > 1 && (
          <div style={momentBannerStyle}>
            <IconSparkle size={13} style={{ verticalAlign: '-2px', marginRight: 5 }} />
            Creating a Moment — {items.length} items
          </div>
        )}

        {/* ── Full-bleed stage ── */}
        <div style={stageStyle}>
          {current.mediaType === 'image' ? (
            <div style={{ position: 'relative', maxWidth: '100%', maxHeight: '100%' }}>
              <canvas ref={canvasRef} style={{ maxWidth: '100%', maxHeight: '100%', display: 'block', borderRadius: 8 }} />
              {activeTool === 'crop' && state?.crop && (
                <div style={{ position: 'absolute', border: '2px solid #fff', boxShadow: '0 0 0 2000px rgba(0,0,0,0.5)', ...cropBoxStyle() }}>
                  <div onMouseDown={dragCorner('tl')} onTouchStart={dragCorner('tl')} style={{ ...handleStyle, left: -8, top: -8, cursor: 'nwse-resize' }} />
                  <div onMouseDown={dragCorner('br')} onTouchStart={dragCorner('br')} style={{ ...handleStyle, right: -8, bottom: -8, cursor: 'nwse-resize' }} />
                </div>
              )}
            </div>
          ) : (
            <video ref={videoRef} src={URL.createObjectURL(current.file)} controls muted={state?.muted} style={{ maxWidth: '100%', maxHeight: '100%', borderRadius: 8 }} />
          )}
        </div>

        {/* ── Multi-item filmstrip (only when >1 item) ── */}
        {items.length > 1 && (
          <div style={filmstripRowStyle}>
            {items.map((it, i) => (
              <button key={i} onClick={() => setIndex(i)} style={{ ...filmstripDotStyle, ...(i === index ? filmstripDotActiveStyle : null) }} />
            ))}
          </div>
        )}

        {/* ── Slide-up tool panel (one at a time) ── */}
        <AnimatePresence>
          {activeTool && (
            <motion.div
              key={activeTool}
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 400, damping: 32 }}
              style={toolPanelStyle}
            >
              <div style={toolPanelHeaderStyle}>
                <span>{TOOL_LABELS[activeTool]}</span>
                <button onClick={() => setActiveTool(null)} style={toolPanelCloseStyle}><IconChevronDown size={16} /></button>
              </div>

              {activeTool === 'crop' && (
                <div style={rowStyle}>
                  {Object.keys(ASPECTS).map(name => (
                    <button key={name} onClick={() => setAspect(name)} style={{ ...pillBtnStyle, background: state?.aspect === name ? ACCENT_GRADIENT : 'rgba(255,255,255,0.08)' }}>{name}</button>
                  ))}
                </div>
              )}

              {activeTool === 'adjust' && (
                <>
                  <SliderRow label="Brightness" value={state?.brightness ?? 100} onChange={v => updateState({ brightness: v })} min={50} max={150} />
                  <SliderRow label="Contrast" value={state?.contrast ?? 100} onChange={v => updateState({ contrast: v })} min={50} max={150} />
                  <SliderRow label="Saturation" value={state?.saturation ?? 100} onChange={v => updateState({ saturation: v })} min={0} max={200} />
                </>
              )}

              {activeTool === 'trim' && (
                <div style={rowStyle}>
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
              )}

              {activeTool === 'speed' && (
                <div style={rowStyle}>
                  <label style={labelStyle}>
                    <input type="checkbox" checked={!!state?.muted} onChange={(e) => updateState({ muted: e.target.checked })} /> Mute
                  </label>
                  <select value={state?.speed ?? 1} onChange={(e) => updateState({ speed: Number(e.target.value) })} style={selectStyle}>
                    {[0.5, 1, 1.5, 2].map(sp => <option key={sp} value={sp}>{sp}x</option>)}
                  </select>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Bottom icon tray — one tap opens/closes its panel ── */}
        <div style={toolTrayStyle}>
          {current.mediaType === 'image' ? (
            <>
              <TrayButton icon={<IconRotateCCW />} label="Rotate" onClick={() => rotate(-1)} />
              <TrayButton icon={<IconCrop />} label="Crop" active={activeTool === 'crop'} onClick={() => toggleTool('crop')} />
              <TrayButton icon={<IconAdjust />} label="Adjust" active={activeTool === 'adjust'} onClick={() => toggleTool('adjust')} />
            </>
          ) : (
            <>
              <TrayButton icon={<IconTrim />} label="Trim" active={activeTool === 'trim'} onClick={() => toggleTool('trim')} />
              <TrayButton icon={<IconSpeed />} label="Speed" active={activeTool === 'speed'} onClick={() => toggleTool('speed')} />
              <TrayButton icon={<IconCamera />} label="Thumbnail" onClick={captureThumbnail} />
            </>
          )}
        </div>

        {/* ── Persistent bottom deck: caption, quality, send ── */}
        <div style={controlsStyle}>
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

          <button
            onClick={momentIntent && items.length > 1 ? handleCreateMoment : handleSend}
            disabled={sending}
            style={sendBtnStyle}
          >
            {sending
              ? 'Preparing…'
              : momentIntent && items.length > 1
                ? `Create Moment (${items.length})`
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

function TrayButton({ icon, label, active, onClick }) {
  return (
    <motion.button whileTap={{ scale: 0.9 }} onClick={onClick} style={{ ...trayBtnStyle, ...(active ? trayBtnActiveStyle : null) }}>
      <span style={{ display: 'flex' }}>{icon}</span>
      <span style={trayBtnLabelStyle}>{label}</span>
    </motion.button>
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

const TOOL_LABELS = { crop: 'Crop', adjust: 'Adjust', trim: 'Trim', speed: 'Speed & Mute' }

// Same brand gradient as MediaStudio/MediaPicker's primary actions —
// hardcoded (not a theme var) since this overlay is always a fixed black
// surface (see overlayStyle) regardless of app theme.
const ACCENT_GRADIENT = 'linear-gradient(135deg, #7F5FFF 0%, #C86DD7 100%)'
const ACCENT_SOLID = '#7F5FFF'

const overlayStyle = { position: 'fixed', inset: 0, zIndex: 80, display: 'flex', flexDirection: 'column', background: '#000' }
const topBarStyle = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', flexShrink: 0 }
const counterStyle = { color: '#fff', fontWeight: 600, fontSize: 13 }
const iconBtnStyle = { width: 36, height: 36, borderRadius: '50%', background: 'rgba(255,255,255,0.1)', color: '#fff', border: 'none', cursor: 'pointer' }
// Stage is now the dominant element — flex:1 lets it claim whatever space
// the chrome around it doesn't need, instead of sharing a fixed 60vh cap
// with a permanently-visible control stack.
const stageStyle = { flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', padding: '0 12px' }
const handleStyle = { position: 'absolute', width: 20, height: 20, background: '#fff', borderRadius: '50%', border: `2px solid ${ACCENT_SOLID}` }

const filmstripRowStyle = { display: 'flex', justifyContent: 'center', gap: 5, padding: '0 0 8px', flexShrink: 0 }
const filmstripDotStyle = { width: 6, height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.35)', border: 'none', cursor: 'pointer', transition: 'all 0.2s' }
const filmstripDotActiveStyle = { width: 18, background: '#fff' }

// Bottom icon tray — single row, icon-over-label, like a mini toolbar
const toolTrayStyle = { display: 'flex', justifyContent: 'center', gap: 28, padding: '4px 16px 10px', flexShrink: 0 }
const trayBtnStyle = { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, background: 'none', border: 'none', color: 'rgba(255,255,255,0.7)', cursor: 'pointer', fontFamily: 'inherit' }
const trayBtnActiveStyle = { color: '#fff' }
const trayBtnLabelStyle = { fontSize: 10.5, fontWeight: 600 }

// Slide-up panel — sits directly above the persistent bottom deck, so it
// never covers caption/quality/send
const toolPanelStyle = { background: 'rgba(20,18,30,0.98)', borderTop: '1px solid rgba(255,255,255,0.1)', padding: '10px 16px 14px', flexShrink: 0 }
const toolPanelHeaderStyle = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#fff', fontSize: 12.5, fontWeight: 700, marginBottom: 8 }
const toolPanelCloseStyle = { background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '50%', width: 24, height: 24, color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }

const controlsStyle = { background: 'rgba(15,13,22,0.96)', padding: '10px 16px max(12px, env(safe-area-inset-bottom))', display: 'flex', flexDirection: 'column', gap: 10, flexShrink: 0, borderTop: '1px solid rgba(255,255,255,0.06)' }
const rowStyle = { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }
const labelStyle = { color: 'rgba(255,255,255,0.75)', fontSize: 12.5, display: 'flex', alignItems: 'center', gap: 6 }
const pillBtnStyle = { padding: '7px 12px', borderRadius: 20, border: 'none', background: 'rgba(255,255,255,0.08)', color: '#fff', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }
const selectStyle = { background: 'rgba(255,255,255,0.08)', color: '#fff', border: 'none', borderRadius: 10, padding: '7px 10px', fontSize: 12.5 }
const captionInputStyle = { background: 'rgba(255,255,255,0.08)', border: 'none', borderRadius: 12, padding: '10px 14px', color: '#fff', fontSize: 14 }
const sendBtnStyle = { background: ACCENT_GRADIENT, color: '#fff', border: 'none', borderRadius: 14, padding: '13px 0', fontWeight: 700, fontSize: 15, cursor: 'pointer' }
const momentBannerStyle = { textAlign: 'center', color: '#c4b5fd', fontSize: 12, fontWeight: 700, padding: '2px 16px 8px', flexShrink: 0 }
const sendAsSeparateLinkStyle = { background: 'none', border: 'none', color: 'rgba(255,255,255,0.55)', fontSize: 12, textAlign: 'center', textDecoration: 'underline', cursor: 'pointer', padding: '2px 0 0', fontFamily: 'inherit' }
