// MediaAssetService.js
// Single source of truth for media_assets CRUD + storage URL resolution.
// Nothing else in the app should touch the media_assets table or storage
// buckets directly — keeps authorization + path conventions in one place.

import { supabase } from '../lib/supabase'

const BUCKETS = {
  image: { original: 'media-originals', optimized: 'media-optimized' },
  video: { original: 'media-originals', optimized: 'media-optimized' },
  audio: { original: 'media-originals' },
  document: { original: 'media-originals' },
  gif: { original: 'media-originals' },
}

const MAX_SIZE_BYTES = {
  image: 25 * 1024 * 1024,
  video: 2 * 1024 * 1024 * 1024, // 2GB, gated to resumable upload path
  audio: 100 * 1024 * 1024,
  document: 100 * 1024 * 1024,
  gif: 25 * 1024 * 1024,
}

const ALLOWED_MIME = {
  image: ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/gif'],
  video: ['video/mp4', 'video/quicktime', 'video/webm', 'video/x-matroska'],
  audio: ['audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/webm', 'audio/ogg'],
  document: [
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
  ],
  gif: ['image/gif'],
}

export class MediaValidationError extends Error {}
/** Uploads a thumbnail Blob to the media-thumbnails bucket and returns its
 * storage path (or null on failure — thumbnail loss should never block a
 * send, so callers treat this as best-effort). Call after the parent
 * media_assets row exists, then patch the path on via updateMediaAssetStatus. */
export async function uploadThumbnail(userId, filename, blob) {
  if (!blob) return null
  const path = buildThumbnailPath(userId, filename)
  const { error } = await supabase.storage.from('media-thumbnails').upload(path, blob, {
    contentType: 'image/jpeg',
    upsert: false,
  })
  if (error) {
    console.error('[MediaAssetService] thumbnail upload failed:', error)
    return null
  }
  return path
}
/** Validate a File before we ever touch the network. Never trust the client
 * beyond this — the storage RLS policies + edge function re-check ownership. */
export function validateFile(file, mediaType) {
  const allowed = ALLOWED_MIME[mediaType] || []
  if (!allowed.includes(file.type)) {
    throw new MediaValidationError(`Unsupported ${mediaType} type: ${file.type || 'unknown'}`)
  }
  const max = MAX_SIZE_BYTES[mediaType] ?? 25 * 1024 * 1024
  if (file.size > max) {
    throw new MediaValidationError(
      `${file.name} is too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Limit is ${(max / 1024 / 1024).toFixed(0)}MB.`
    )
  }
  return true
}

function sanitizeFilename(name) {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-120)
}

/** Builds the storage path convention: {user_id}/{media_type}/{timestamp}-{filename} */
export function buildStoragePath(userId, mediaType, filename) {
  const folder = { image: 'images', video: 'videos', audio: 'audio', document: 'documents', gif: 'images' }[mediaType] || 'documents'
  return `${userId}/${folder}/${Date.now()}-${sanitizeFilename(filename)}`
}

export function buildThumbnailPath(userId, filename) {
  return `${userId}/thumbnails/${Date.now()}-thumb-${sanitizeFilename(filename)}`
}

/** Create the DB row before any bytes are uploaded, so the message can render
 * an optimistic "preparing" state immediately. */
export async function createMediaAssetRow({
  conversationId,
  senderId,
  messageId = null, 
  mediaType,
  mimeType,
  filename,
  storagePath,
  sizeBytes,
  width = null,
  height = null,
  duration = null,
  isViewOnce = false,
  expiresAt = null,
   momentOrder = 0,          
  isMomentCover = false,
}) {
  const { data, error } = await supabase
    .from('media_assets')
    .insert({
      conversation_id: conversationId,
      sender_id: senderId,
      media_type: mediaType,
      mime_type: mimeType,
      filename,
      storage_path: storagePath,
      size_bytes: sizeBytes,
      width,
      height,
      duration,
      is_view_once: isViewOnce,
      expires_at: expiresAt,
      upload_status: 'preparing',
      processing_status: 'pending',
      upload_progress: 0,
    })
    .select()
    .single()

  if (error) throw error
  return data
}

export async function updateMediaAssetStatus(assetId, patch) {
  const { data, error } = await supabase
    .from('media_assets')
    .update(patch)
    .eq('id', assetId)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function attachAssetToMessage(assetId, messageId) {
  return updateMediaAssetStatus(assetId, { message_id: messageId, upload_status: 'sent' })
}

export async function deleteMediaAsset(asset) {
  const paths = [asset.storage_path, asset.optimized_path, asset.thumbnail_path].filter(Boolean)
  if (paths.length) {
    await supabase.storage.from('media-originals').remove(paths.filter(p => p === asset.storage_path))
    if (asset.optimized_path) await supabase.storage.from('media-optimized').remove([asset.optimized_path])
    if (asset.thumbnail_path) await supabase.storage.from('media-thumbnails').remove([asset.thumbnail_path])
  }
  const { error } = await supabase.from('media_assets').delete().eq('id', asset.id)
  if (error) throw error
}

/** Resolve a short-lived signed URL. Never construct/expose a public URL for
 * private media — every render path goes through this. */
export async function getSignedUrl(mediaType, path, { thumbnail = false, expiresIn = 3600 } = {}) {
  if (!path) return null
  const bucket = thumbnail ? 'media-thumbnails' : (BUCKETS[mediaType]?.original || 'media-originals')
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, expiresIn)
  if (error) {
    console.error('[MediaAssetService] signed URL failed:', error)
    return null
  }
  return data.signedUrl
}

/** Marks a view-once asset as viewed. Server-side RLS then hides the
 * storage row from everyone except the sender — this call does not itself
 * delete bytes, it flips the row that gates access. */
export async function markViewOnceViewed(assetId, viewerId) {
  return updateMediaAssetStatus(assetId, { viewed_at: new Date().toISOString(), viewed_by: viewerId })
}

export async function getAssetsForMessage(messageId) {
  const { data, error } = await supabase.from('media_assets').select('*').eq('message_id', messageId)
  if (error) throw error
  return data
}
