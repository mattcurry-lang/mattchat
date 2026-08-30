// UploadManager.js
// Handles the actual byte transfer for media uploads without blocking the
// chat UI.
//
// Three paths, chosen automatically per file:
//   1. Direct (small, non-video files) — one PUT to Supabase Storage.
//   2. Resumable/TUS to Supabase Storage — large files, or any video
//      under the Cloudflare Stream threshold.
//   3. Cloudflare Stream (Phase 9) — videos over CF_STREAM_THRESHOLD, IF
//      Cloudflare Stream secrets are configured server-side. Falls back
//      to path 2 automatically and silently if cf-stream-direct-upload
//      reports { ok:false, reason:'not_configured' } or fails outright —
//      callers never need to know which path was actually used.
//
// Requires: npm install tus-js-client
//
// Usage:
//   const upload = uploadManager.start({ file, assetId, mediaType, storagePath, conversationId, onProgress, onStatusChange })
//   upload.pause() / upload.resume() / upload.cancel()

import * as tus from 'tus-js-client'
import { supabase } from '../lib/supabase'
import { updateMediaAssetStatus } from './MediaAssetService'
import { requestDirectUpload, uploadToStreamTus } from './CloudflareStreamService'

const RESUMABLE_THRESHOLD = 6 * 1024 * 1024   // 6MB — above this, always use TUS
const CF_STREAM_THRESHOLD = 20 * 1024 * 1024  // 20MB — above this, try Cloudflare Stream first (video only)
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const BUCKET_BY_TYPE = { image: 'media-originals', video: 'media-originals', audio: 'media-originals', document: 'media-originals', gif: 'media-originals' }

// In-memory registry so a component unmount/remount (e.g. navigating away
// and back to a conversation) can reattach to an in-flight upload instead
// of starting a duplicate.
const activeUploads = new Map() // assetId -> { upload, controller }

class UploadHandle {
  constructor(assetId) {
    this.assetId = assetId
  }
  pause() {
    activeUploads.get(this.assetId)?.upload?.abort()
  }
  resume() {
    activeUploads.get(this.assetId)?.upload?.start()
  }
  cancel() {
    const entry = activeUploads.get(this.assetId)
    entry?.upload?.abort(true)
    activeUploads.delete(this.assetId)
  }
}

async function getAuthHeader() {
  const { data } = await supabase.auth.getSession()
  return `Bearer ${data?.session?.access_token}`
}

/** Direct (non-resumable) path for small files — one PUT, no chunking overhead. */
async function uploadDirect({ file, mediaType, storagePath, onProgress, onStatusChange }) {
  onStatusChange('uploading')
  const bucket = BUCKET_BY_TYPE[mediaType] || 'media-originals'

  const fakeProgress = setInterval(() => onProgress(Math.round(Math.min(90, Math.random() * 40 + 40))), 200)

  const { error } = await supabase.storage.from(bucket).upload(storagePath, file, {
    contentType: file.type,
    upsert: false,
  })

  clearInterval(fakeProgress)
  if (error) {
    onStatusChange('failed')
    throw error
  }
  onProgress(100)
  onStatusChange('processing')
  return { path: storagePath }
}

/** Resumable TUS path for large/video files. Supabase Storage exposes a
 * TUS-compatible endpoint at /storage/v1/upload/resumable. */
function uploadResumable({ file, mediaType, storagePath, assetId, onProgress, onStatusChange, onError }) {
  const bucket = BUCKET_BY_TYPE[mediaType] || 'media-originals'

  return new Promise((resolve, reject) => {
    getAuthHeader().then((authHeader) => {
      const upload = new tus.Upload(file, {
        endpoint: `${SUPABASE_URL}/storage/v1/upload/resumable`,
        retryDelays: [0, 3000, 8000, 15000, 30000],
        headers: { authorization: authHeader },
        chunkSize: 6 * 1024 * 1024,
        metadata: {
          bucketName: bucket,
          objectName: storagePath,
          contentType: file.type,
          cacheControl: '3600',
        },
        onError: (err) => {
          onStatusChange('failed')
          onError?.(err)
          reject(err)
        },
        onProgress: (sent, total) => {
          onProgress(Math.round((sent / total) * 100))
        },
        onSuccess: () => {
          onProgress(100)
          onStatusChange('processing')
          resolve({ path: storagePath })
        },
      })

      upload.findPreviousUploads().then((previous) => {
        if (previous.length) upload.resumeFromPreviousUpload(previous[0])
        upload.start()
      })

      activeUploads.set(assetId, { upload })
      onStatusChange('uploading')
    })
  })
}

/** Cloudflare Stream path for large videos. Requests a direct-upload
 * session, stores the resulting cf_stream_uid on the media_assets row as
 * soon as it's known (so playback code has something to key off even
 * before the transfer finishes), then hands the returned TUS endpoint to
 * tus-js-client directly — no Supabase Storage bytes are written for
 * these files at all. storage_path stays as a harmless placeholder;
 * MediaMessage/MediaViewer check cf_stream_uid first and only fall back
 * to storage_path when it's absent.
 *
 * Note: we don't poll Cloudflare's own readyToStream/transcode status —
 * once the browser's TUS upload finishes, we mark our own upload_status
 * 'processing' -> 'sent' the same way the Supabase Storage path does.
 * The video may still be encoding on Cloudflare's side for a few seconds
 * after that; a real readiness check would need either polling or a
 * webhook and is a reasonable follow-up, not built here. */
async function uploadToCloudflareStream({ file, mediaType, assetId, conversationId, onProgress, onStatusChange, onError }) {
  const session = await requestDirectUpload({
    conversationId,
    filename: file.name,
    fileSize: file.size,
  })

  if (!session.ok) {
    if (session.reason !== 'not_configured') {
      console.warn('[UploadManager] Cloudflare Stream unavailable, falling back to Supabase Storage:', session.reason)
    }
    return null // signals "not used" — caller falls through to Supabase Storage
  }

  await updateMediaAssetStatus(assetId, { cf_stream_uid: session.uid }).catch((e) =>
    console.error('[UploadManager] failed to persist cf_stream_uid:', e)
  )

  const uploadPromise = uploadToStreamTus({
    file,
    uploadUrl: session.uploadUrl,
    onProgress,
    onStatusChange,
    onError,
  })

  activeUploads.set(assetId, { upload: null }) // TUS instance is internal to CloudflareStreamService; pause/resume isn't wired for this path yet
  await uploadPromise
  return { path: null, cfStreamUid: session.uid }
}

export const uploadManager = {
  /**
   * Starts an upload and returns a handle immediately (non-blocking).
   * onProgress(percent: 0-100), onStatusChange('uploading'|'processing'|'sent'|'failed')
   * both also persist to media_assets so a resync/reload reflects true state.
   */
  start({ file, assetId, mediaType, storagePath, conversationId, onProgress = () => {}, onStatusChange = () => {} }) {
    const handle = new UploadHandle(assetId)

    const wrappedProgress = (pct) => {
      onProgress(pct)
      updateMediaAssetStatus(assetId, { upload_progress: pct }).catch(() => {})
    }
    const wrappedStatus = (status) => {
      onStatusChange(status)
      updateMediaAssetStatus(assetId, { upload_status: status }).catch(() => {})
    }

    const run = async () => {
      const useCfStream = mediaType === 'video' && file.size > CF_STREAM_THRESHOLD && conversationId
      if (useCfStream) {
        try {
          const result = await uploadToCloudflareStream({
            file, mediaType, assetId, conversationId,
            onProgress: wrappedProgress, onStatusChange: wrappedStatus,
          })
          if (result) return result // Cloudflare path succeeded
        } catch (err) {
          console.error('[UploadManager] Cloudflare Stream upload failed, falling back:', err)
          // fall through to Supabase Storage path below
        }
      }

      const useResumable = file.size > RESUMABLE_THRESHOLD || mediaType === 'video'
      return useResumable
        ? uploadResumable({ file, mediaType, storagePath, assetId, onProgress: wrappedProgress, onStatusChange: wrappedStatus })
        : uploadDirect({ file, mediaType, storagePath, onProgress: wrappedProgress, onStatusChange: wrappedStatus })
    }

    run()
      .then(() => {
        activeUploads.delete(assetId)
      })
      .catch((err) => {
        console.error('[UploadManager] upload failed:', err)
        activeUploads.delete(assetId)
      })

    return handle
  },

  retry({ file, assetId, mediaType, storagePath, conversationId, onProgress, onStatusChange }) {
    activeUploads.delete(assetId)
    return this.start({ file, assetId, mediaType, storagePath, conversationId, onProgress, onStatusChange })
  },

  getHandle(assetId) {
    return activeUploads.has(assetId) ? new UploadHandle(assetId) : null
  },

  isUploading(assetId) {
    return activeUploads.has(assetId)
  },
}
