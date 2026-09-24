import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
function openVideo(src, crossOrigin) {
  return new Promise((resolve, reject) => {
    const v = document.createElement('video')
    if (crossOrigin) v.crossOrigin = 'anonymous'
    v.muted = true
    v.playsInline = true
    v.preload = 'auto'
    v.onloadeddata = () => resolve(v)
    v.onerror = () => reject(new Error(`code ${v.error?.code}: ${v.error?.message || 'no detail'}`))
    setTimeout(() => reject(new Error('timed out loading video')), 20000)
    v.src = src
  })
}

async function grabFrames(video, count) {
  const dur = video.duration
  if (!isFinite(dur) || dur <= 0) throw new Error('unreadable duration')
  const scale = Math.min(1, 640 / Math.max(video.videoWidth, video.videoHeight))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(video.videoWidth * scale)
  canvas.height = Math.round(video.videoHeight * scale)
  const ctx = canvas.getContext('2d')
  const frames = []
  for (let i = 0; i < count; i++) {
    await new Promise((resolve) => {
      const t = setTimeout(resolve, 4000)
      video.onseeked = () => { clearTimeout(t); resolve() }
      video.currentTime = (dur * (i + 0.5)) / count
    })
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    frames.push(canvas.toDataURL('image/jpeg', 0.6)) // throws if the canvas is tainted
  }
  return frames
}

// source: a video URL, or a File the admin picked from their device.
async function extractFrames(source, count = 8) {
  const attempts = []
  if (source instanceof File) {
    attempts.push(async () => {
      const u = URL.createObjectURL(source)
      try { return await grabFrames(await openVideo(u, false), count) } finally { URL.revokeObjectURL(u) }
    })
  } else {
    attempts.push(async () => grabFrames(await openVideo(source, true), count)) // direct, CORS-enabled
    attempts.push(async () => {
      const res = await fetch(source)
      if (!res.ok) throw new Error(`download ${res.status}`)
      const u = URL.createObjectURL(await res.blob()) // keep the server's own type
      try { return await grabFrames(await openVideo(u, false), count) } finally { URL.revokeObjectURL(u) }
    })
  }
  const errors = []
  for (const run of attempts) {
    try { return await run() } catch (e) { errors.push(e.message) }
  }
  const err = new Error(`Couldn't read the video in the browser (${errors.join(' | ')}). Use "Choose the video file" and pick the original from your device.`)
  err.needsFile = true
  throw err
}

export function useDekutRoutes({ isAdmin } = {}) {
  const [drafts, setDrafts] = useState([])
  const [approved, setApproved] = useState({}) // location_id -> route
  const [busyId, setBusyId] = useState(null)
  const [error, setError] = useState(null)
  const [needsFileId, setNeedsFileId] = useState(null

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
  const generate = useCallback(async (loc, file) => {
    setBusyId(loc.id); setError(null); setNeedsFileId(null)
    try {
      const frames = await extractFrames(file || loc.video_url, 8)
      const { data, error: err } = await supabase.functions.invoke('dekut-video-route', { body: { location_id: loc.id, frames } })
      if (err) {
        let msg = err.message
        try { msg = (await err.context.json()).error || msg } catch { /* keep */ }
        throw new Error(msg)
      }
      if (data?.error) throw new Error(data.error)
      await loadDrafts()
      return true
    } catch (e) {
      setError(e.message)
      if (e.needsFile) setNeedsFileId(loc.id)
      return false
    } finally { setBusyId(null) }
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

  return { drafts, approved, busyId, error, generate, approve, reject,needsFileId }
}
