// src/hooks/useDekutLocations.js
//
// Data layer for the DeKUT Room Finder (spec §4). Verified locations are
// visible to everyone; a student's own pending suggestions are visible
// only to them; admins see the full pending queue for moderation.
// RLS (see the dekut_locations table policies) enforces all of this
// server-side too — this hook doesn't do any authorization itself.

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

export function useDekutLocations({ userId, isAdmin } = {}) {
  const [locations, setLocations] = useState([]) // verified only
  const [pending, setPending] = useState([])     // admin-only queue
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const loadVerified = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('dekut_locations')
      .select('*')
      .eq('is_verified', true)
      .order('name', { ascending: true })
    if (error) {
      console.error('loadVerified failed:', error)
      setError(error)
    } else {
      setLocations(data || [])
      setError(null)
    }
    setLoading(false)
  }, [])

  const loadPending = useCallback(async () => {
    if (!isAdmin) { setPending([]); return }
    const { data, error } = await supabase
      .from('dekut_locations')
      .select('*')
      .eq('is_verified', false)
      .order('created_at', { ascending: false })
    if (error) console.error('loadPending failed:', error)
    else setPending(data || [])
  }, [isAdmin])

  useEffect(() => { loadVerified() }, [loadVerified])
  useEffect(() => { loadPending() }, [loadPending])

    // Uploads a video file to Storage and returns its public URL — call this
  // BEFORE submitLocation/attachVideo so you have the url to save on the row.
  const uploadLocationVideo = useCallback(async (file) => {
    if (!userId) throw new Error('You need to be signed in to upload a video.')
    const ext = file.name.split('.').pop() || 'mp4'
    const path = `${userId}/${crypto.randomUUID()}.${ext}`
    const { error } = await supabase.storage
      .from('dekut-location-videos')
      .upload(path, file, { contentType: file.type, upsert: false })
    if (error) throw error
    const { data } = supabase.storage.from('dekut-location-videos').getPublicUrl(path)
    return data.publicUrl
  }, [userId])

  // Attaches a video (uploaded or an external link) to an EXISTING
  // verified location. Anyone can suggest one — it doesn't need admin
  // approval separately since it's just enriching an already-verified
  // room, not adding a new unverified one.
  const attachVideo = useCallback(async (locationId, { videoType, videoUrl }) => {
    if (!userId) throw new Error('You need to be signed in to add a video.')
    const { error } = await supabase
      .from('dekut_locations')
      .update({ video_type: videoType, video_url: videoUrl, video_uploaded_by: userId })
      .eq('id', locationId)
    if (error) throw error
    await loadVerified()
  }, [userId, loadVerified])
  
  const submitLocation = useCallback(async (payload) => {
    if (!userId) throw new Error('You need to be signed in to suggest a location.')
    const { error } = await supabase.from('dekut_locations').insert({
      ...payload,
      submitted_by: userId,
      is_verified: false,
    })
    if (error) throw error
  }, [userId])

  const approveLocation = useCallback(async (id) => {
    const { error } = await supabase
      .from('dekut_locations')
      .update({ is_verified: true, approved_by: userId, approved_at: new Date().toISOString() })
      .eq('id', id)
    if (error) throw error
    await Promise.all([loadVerified(), loadPending()])
  }, [userId, loadVerified, loadPending])

  const rejectLocation = useCallback(async (id) => {
    const { error } = await supabase.from('dekut_locations').delete().eq('id', id)
    if (error) throw error
    await loadPending()
  }, [loadPending])

  // Admin-only: place (or move) a location on the schematic map. Never
  // auto-generated — always a real click from someone who actually
  // knows where the place is.
  const setMapPosition = useCallback(async (id, x, y) => {
    const { error } = await supabase
      .from('dekut_locations')
      .update({ map_x: x, map_y: y })
      .eq('id', id)
    if (error) throw error
    await loadVerified()
  }, [loadVerified])

  return {
  locations, pending, loading, error,
  submitLocation, approveLocation, rejectLocation, setMapPosition,
  uploadLocationVideo, attachVideo,  
  reload: loadVerified,
}
}
