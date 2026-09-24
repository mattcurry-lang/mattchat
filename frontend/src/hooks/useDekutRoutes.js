import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
async function extractFrames(url, count = 8) {
  let blobUrl = null
  try {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`Video download failed (${res.status}).`)
       const raw = await res.blob()
    const type = raw.type && raw.type.startsWith('video/') ? raw.type : 'video/mp4'
    blobUrl = URL.createObjectURL(new Blob([raw], { type }))
  } catch (e) {
    throw new Error(e.message?.startsWith('Video download') ? e.message : "Couldn't download the video from storage (network or CORS).")
  }
  const video = document.createElement('video')
  video.muted = true
  video.playsInline = true
  video.preload = 'auto'
  video.src = blobUrl
  await new Promise((resolve, reject) => {
    video.onloadedmetadata = resolve
       video.onerror = () => reject(new Error(`Video decode failed (code ${video.error?.code}, ${video.error?.message || 'no detail'}, type ${video.canPlayType('video/mp4') ? 'mp4 ok' : 'mp4 unsupported'}).`))
  })
  const dur = video.duration
  if (!isFinite(dur) || dur <= 0) throw new Error("Couldn't read the video length.")
  const scale = 640 / Math.max(video.videoWidth, video.videoHeight)
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(video.videoWidth * Math.min(1, scale))
  canvas.height = Math.round(video.videoHeight * Math.min(1, scale))
  const ctx = canvas.getContext('2d')
  const frames = []
  for (let i = 0; i < count; i++) {
    await new Promise((resolve) => { video.onseeked = resolve; video.currentTime = (dur * (i + 0.5)) / count })
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    try { frames.push(canvas.toDataURL('image/jpeg', 0.6)) }
    catch { throw new Error("The browser blocked reading this video's frames (storage CORS).") }
  }
  URL.revokeObjectURL(blobUrl)
  return frames
}

export function useDekutRoutes({ isAdmin } = {}) {
  const [drafts, setDrafts] = useState([])
  const [approved, setApproved] = useState({}) // location_id -> route
  const [busyId, setBusyId] = useState(null)
  const [error, setError] = useState(null)

  const loadApproved = useCallback(async () => {
    const { data } = await supabase.from('dekut_location_routes')
      .select('location_id, steps, reverse_steps, start_point, approved_at')
      .eq('status', 'approved').order('approved_at', { ascending: true })
    const m = {}
    ;(data || []).forEach((r) => { m[r.location_id] = r })
    setApproved(m)
  }, [])

  const loadDrafts = useCallback(async () => {
    if (!isAdmin) return
    const { data } = await supabase.from('dekut_location_routes')
      .select('*, dekut_locations(name)').eq('status', 'draft').order('created_at', { ascending: false })
    setDrafts(data || [])
  }, [isAdmin])

  useEffect(() => { loadApproved(); loadDrafts() }, [loadApproved, loadDrafts])

  const generate = useCallback(async (loc) => {
    setBusyId(loc.id); setError(null)
    try {
      const frames = await extractFrames(loc.video_url, 8)
      const { data, error: err } = await supabase.functions.invoke('dekut-video-route', { body: { location_id: loc.id, frames } })
      if (err) {
        let msg = err.message
        try { msg = (await err.context.json()).error || msg } catch { /* keep */ }
        throw new Error(msg)
      }
      if (data?.error) throw new Error(data.error)
      await loadDrafts()
      return true
    } catch (e) { setError(e.message); return false } finally { setBusyId(null) }
  }, [loadDrafts])

  const approve = useCallback(async (id, steps, reverseSteps) => {
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('dekut_location_routes')
      .update({ status: 'approved', steps, reverse_steps: reverseSteps, approved_by: user?.id, approved_at: new Date().toISOString() }).eq('id', id)
    loadDrafts(); loadApproved()
  }, [loadDrafts, loadApproved])

  const reject = useCallback(async (id) => {
    await supabase.from('dekut_location_routes').update({ status: 'rejected' }).eq('id', id)
    loadDrafts()
  }, [loadDrafts])

  return { drafts, approved, busyId, error, generate, approve, reject }
}
