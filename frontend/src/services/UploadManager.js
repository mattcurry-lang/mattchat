// UploadManager.js
// Handles the actual byte transfer for media uploads without blocking the
// chat UI. Small files go through a direct Supabase Storage upload; large
// files (video, or anything over RESUMABLE_THRESHOLD) go through TUS so an
// interrupted connection can resume instead of restarting from zero.
//
// Requires: npm install tus-js-client
//
// Usage:
//   const upload = uploadManager.start({ file, assetId, mediaType, storagePath, onProgress, onStatusChange })
//   upload.pause() / upload.resume() / upload.cancel()

import * as tus from 'tus-js-client'
import { supabase } from '../lib/supabase'
import { updateMediaAssetStatus } from './MediaAssetService'

const RESUMABLE_THRESHOLD = 6 * 1024 * 1024 // 6MB — above this, always use TUS
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const BUCKET_BY_TYPE = { image: 'media-originals', video: 'media-originals', audio: 'media-originals', document: 'media-originals', gif: 'media-originals' }

// In-memory registry so a component unmount/remount (e.g. navigating away
// and back to a conversation) can reattach to an in-flight upload instead of
// starting a duplicate.
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

  // Supabase-js doesn't expose byte-level progress on the simple upload path,
  // so we simulate a smooth ramp and correct to 100 on completion. Good
  // enough for small files where the whole thing takes <1-2s anyway.
  const fakeProgress = setInterval(() => onProgress(Math.min(90, Math.random() * 40 + 40)), 200)

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
        chunkSize: 6 * 1024 * 1024, // required by Supabase's TUS implementation
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

      // Resume a previous session for this file if one exists (survives
      // page reloads because tus-js-client persists fingerprints in
      // localStorage by default).
      upload.findPreviousUploads().then((previous) => {
        if (previous.length) upload.resumeFromPreviousUpload(previous[0])
        upload.start()
      })

      activeUploads.set(assetId, { upload })
      onStatusChange('uploading')
    })
  })
}

export const uploadManager = {
  /**
   * Starts an upload and returns a handle immediately (non-blocking).
   * onProgress(percent: 0-100), onStatusChange('uploading'|'processing'|'sent'|'failed')
   * both also persist to media_assets so a resync/reload reflects true state.
   */
  start({ file, assetId, mediaType, storagePath, onProgress = () => {}, onStatusChange = () => {} }) {
    const handle = new UploadHandle(assetId)
    const useResumable = file.size > RESUMABLE_THRESHOLD || mediaType === 'video'

    const wrappedProgress = (pct) => {
      onProgress(pct)
      updateMediaAssetStatus(assetId, { upload_progress: pct }).catch(() => {})
    }
    const wrappedStatus = (status) => {
      onStatusChange(status)
      updateMediaAssetStatus(assetId, { upload_status: status }).catch(() => {})
    }

    const task = useResumable
      ? uploadResumable({ file, mediaType, storagePath, assetId, onProgress: wrappedProgress, onStatusChange: wrappedStatus })
      : uploadDirect({ file, mediaType, storagePath, onProgress: wrappedProgress, onStatusChange: wrappedStatus })

    task
      .then(() => {
        activeUploads.delete(assetId)
      })
      .catch((err) => {
        console.error('[UploadManager] upload failed:', err)
        activeUploads.delete(assetId)
      })

    return handle
  },

  retry({ file, assetId, mediaType, storagePath, onProgress, onStatusChange }) {
    activeUploads.delete(assetId) // drop any stale handle first
    return this.start({ file, assetId, mediaType, storagePath, onProgress, onStatusChange })
  },

  getHandle(assetId) {
    return activeUploads.has(assetId) ? new UploadHandle(assetId) : null
  },

  isUploading(assetId) {
    return activeUploads.has(assetId)
  },
}
