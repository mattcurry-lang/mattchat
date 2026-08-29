// CloudflareStreamService.js
// Thin wrapper around the two cf-stream-* edge functions plus the TUS
// upload itself. Every call degrades to { ok: false } rather than
// throwing, so UploadManager can treat "Cloudflare Stream isn't
// configured" as a normal, silent fallback rather than an error path —
// matches the existing edge-function convention of ok:false over hard
// failures.

import * as tus from 'tus-js-client'
import { supabase } from '../lib/supabase'

// Safe to expose — this is just the public embed-URL customer subdomain
// Cloudflare assigns per account, not a secret.
const CUSTOMER_CODE = import.meta.env.VITE_CF_STREAM_CUSTOMER_CODE

async function invoke(fnName, body) {
  const { data, error } = await supabase.functions.invoke(fnName, { body })
  if (error) {
    console.error(`[CloudflareStreamService] ${fnName} invoke failed:`, error)
    return { ok: false, reason: 'invoke_failed' }
  }
  return data
}

/** Asks the backend to open a Cloudflare Stream direct-upload session for
 * this file. Returns { ok:false, reason:'not_configured' } if Cloudflare
 * Stream secrets aren't set — callers should treat that as "use the
 * normal Supabase Storage path instead," not as an error to surface. */
export async function requestDirectUpload({ conversationId, filename, fileSize }) {
  return invoke('cf-stream-direct-upload', { conversationId, filename, fileSize })
}

/** Uploads a file to a Cloudflare Stream TUS endpoint obtained from
 * requestDirectUpload(). Mirrors UploadManager's uploadResumable shape so
 * it's a drop-in alternative upload path. */
export function uploadToStreamTus({ file, uploadUrl, onProgress, onStatusChange, onError }) {
  return new Promise((resolve, reject) => {
    const upload = new tus.Upload(file, {
      uploadUrl, // resume/complete an existing session rather than creating a new one
      retryDelays: [0, 3000, 8000, 15000, 30000],
      chunkSize: 6 * 1024 * 1024,
      onError: (err) => {
        onStatusChange?.('failed')
        onError?.(err)
        reject(err)
      },
      onProgress: (sent, total) => onProgress?.(Math.round((sent / total) * 100)),
      onSuccess: () => {
        onProgress?.(100)
        onStatusChange?.('processing') // CF still needs to transcode before it's watchable
        resolve()
      },
    })
    onStatusChange?.('uploading')
    upload.start()
  })
}

/** Mints a short-lived playback token for a cf_stream_uid. Returns
 * { ok:false } for anything from "not configured" to "view-once already
 * consumed" — callers should fall back to a generic unavailable state
 * rather than assuming a specific reason. */
export async function getStreamPlaybackToken(assetId) {
  return invoke('cf-stream-signed-url', { assetId })
}

export function streamThumbnailUrl(token, { time = '0s', width = 640 } = {}) {
  if (!CUSTOMER_CODE || !token) return null
  return `https://customer-${CUSTOMER_CODE}.cloudflarestream.com/${token}/thumbnails/thumbnail.jpg?time=${time}&width=${width}`
}

export function streamIframeUrl(token) {
  if (!CUSTOMER_CODE || !token) return null
  return `https://customer-${CUSTOMER_CODE}.cloudflarestream.com/${token}/iframe`
}
