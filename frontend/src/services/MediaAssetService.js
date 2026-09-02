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
 * an optimistic "preparing" state immediately.
 *
 * Blur/reveal params (isBlurred / blurRevealMethod / revealCodeHash /
 * revealCodeSalt) mirror the same single-item scoping as isViewOnce — the
 * caller (useChat.sendMediaMessage) only ever passes them for a genuine
 * single-item send, same as before. revealCodeHash/Salt are already
 * hashed client-side in MediaComposer before they reach here — this
 * function never sees a plaintext code. */
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
  isBlurred = false,
  blurRevealMethod = null,
  revealCodeHash = null,
  revealCodeSalt = null,
   momentOrder = 0,          
  isMomentCover = false,
}) {
 const { data, error } = await supabase
  .from('media_assets')
  .insert({
    conversation_id: conversationId,
    sender_id: senderId,
    message_id: messageId,   // ← add this line
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
    is_blurred: isBlurred,
    blur_reveal_method: isBlurred ? blurRevealMethod : null,
    reveal_code_hash: isBlurred && blurRevealMethod === 'code' ? revealCodeHash : null,
    reveal_code_salt: isBlurred && blurRevealMethod === 'code' ? revealCodeSalt : null,
    upload_status: 'preparing',
    processing_status: 'pending',
    upload_progress: 0,
    moment_order: momentOrder,
    is_moment_cover: isMomentCover,
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

// ── Signed URL cache ────────────────────────────────────────────────
// getSignedUrl was being called fresh on every MediaMessage mount, with
// no caching at all — reopening a conversation re-fetched a brand new
// signed URL for every single document/image/video in its history, all
// at once, every time. That's the "documents take a while to load" bug.
//
// Cache key: `${bucket}:${path}`. We cache for slightly less than the
// signed URL's actual expiresIn (a 30s safety margin) so a cached URL is
// never handed out after Supabase has already invalidated it.
const signedUrlCache = new Map() // key -> { url, expiresAt }
const SAFETY_MARGIN_MS = 30 * 1000

function getCachedSignedUrl(cacheKey) {
  const entry = signedUrlCache.get(cacheKey)
  if (!entry) return null
  if (Date.now() >= entry.expiresAt) {
    signedUrlCache.delete(cacheKey)
    return null
  }
  return entry.url
}

function setCachedSignedUrl(cacheKey, url, expiresIn) {
  signedUrlCache.set(cacheKey, {
    url,
    expiresAt: Date.now() + expiresIn * 1000 - SAFETY_MARGIN_MS,
  })
}

/** Resolve a short-lived signed URL. Never construct/expose a public URL for
 * private media — every render path goes through this. Cached in memory so
 * repeated mounts (reopening a conversation, re-rendering a message list)
 * reuse an existing still-valid URL instead of re-fetching from Storage. */
export async function getSignedUrl(mediaType, path, { thumbnail = false, expiresIn = 3600 } = {}) {
  if (!path) return null
  const bucket = thumbnail ? 'media-thumbnails' : (BUCKETS[mediaType]?.original || 'media-originals')
  const cacheKey = `${bucket}:${path}`

  const cached = getCachedSignedUrl(cacheKey)
  if (cached) return cached

  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, expiresIn)
  if (error) {
    console.error('[MediaAssetService] signed URL failed:', error)
    return null
  }

  setCachedSignedUrl(cacheKey, data.signedUrl, expiresIn)
  return data.signedUrl
}

/** Marks a view-once asset as viewed. Server-side RLS then hides the
 * storage row from everyone except the sender — this call does not itself
 * delete bytes, it flips the row that gates access. */
export async function markViewOnceViewed(assetId, viewerId) {
  return updateMediaAssetStatus(assetId, { viewed_at: new Date().toISOString(), viewed_by: viewerId })
}

// ── Blur / reveal ───────────────────────────────────────────────────

/** Verifies a recipient-entered code against the stored hash/salt for a
 * blurred asset. Fetches only reveal_code_hash + reveal_code_salt (never
 * the plaintext, which was never stored). Hashing/compare mirrors
 * MediaComposer's hashRevealCode exactly (SHA-256(salt + code)) so a
 * correct guess always matches.
 *
 * This is a fun-feature lock, not a security boundary (same reasoning as
 * the single fast SHA-256 pass used when hashing at send time) — anyone
 * with read access to the row can fetch the hash+salt and brute-force a
 * 4-digit code offline in milliseconds. If that's ever a real concern,
 * this needs to move server-side (an RPC/edge function that does the
 * compare without ever returning the hash to the client). */
export async function verifyRevealCode(assetId, code) {
  const { data, error } = await supabase
    .from('media_assets')
    .select('reveal_code_hash, reveal_code_salt')
    .eq('id', assetId)
    .single()
  if (error || !data?.reveal_code_hash || !data?.reveal_code_salt) return false

  const enc = new TextEncoder().encode(data.reveal_code_salt + code)
  const digest = await crypto.subtle.digest('SHA-256', enc)
  const hashHex = Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('')
  return hashHex === data.reveal_code_hash
}

/** Marks a blurred asset as revealed — global, not per-viewer (see the
 * comment on the migration's blur_revealed_at column). Once this lands,
 * the media_assets realtime UPDATE subscription in useChat propagates it
 * to every other participant automatically, so it un-blurs for everyone
 * without a page reload. */
export async function markBlurRevealed(assetId, viewerId = null) {
  return updateMediaAssetStatus(assetId, {
    blur_revealed_at: new Date().toISOString(),
    blur_revealed_by: viewerId,
  })
}

export async function getAssetsForMessage(messageId) {
  const { data, error } = await supabase.from('media_assets').select('*').eq('message_id', messageId)
  if (error) throw error
  return data
}
