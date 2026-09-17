// src/hooks/useDekutLocations.js
//
// Data layer for the DeKUT Room Finder (spec §4) plus, as of Phase 3,
// the walking-path graph between verified locations (spec §11/§15).
// Verified locations are visible to everyone; a student's own pending
// suggestions are visible only to them; admins see the full pending
// queue for moderation. RLS (see the dekut_locations/dekut_location_edges
// table policies) enforces all of this server-side too — this hook
// doesn't do any authorization itself.

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

export function useDekutLocations({ userId, isAdmin } = {}) {
  const [locations, setLocations] = useState([]) // verified only
  const [pending, setPending] = useState([])     // admin-only queue
  const [edges, setEdges] = useState([])         // walking-path graph, verified locations only
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [pendingVideos, setPendingVideos] = useState([])

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

  const loadEdges = useCallback(async () => {
    const { data, error } = await supabase.from('dekut_location_edges').select('*')
    if (error) console.error('loadEdges failed:', error)
    else setEdges(data || [])
  }, [])

  const loadPending = useCallback(async () => {
    if (!isAdmin) { setPending([]); setPendingVideos([]); return }
    const [{ data: locData, error: locErr }, { data: vidData, error: vidErr }] = await Promise.all([
      supabase.from('dekut_locations').select('*').eq('is_verified', false).order('created_at', { ascending: false }),
      supabase.from('dekut_locations').select('*')
        .eq('is_verified', true) // only verified locations can have a video queue
        .neq('video_type', 'none')
        .eq('is_video_verified', false)
        .order('created_at', { ascending: false }),
    ])
    if (locErr) console.error('loadPending (locations) failed:', locErr)
    else setPending(locData || [])
    if (vidErr) console.error('loadPending (videos) failed:', vidErr)
    else setPendingVideos(vidData || [])
  }, [isAdmin])

  useEffect(() => { loadVerified() }, [loadVerified])
  useEffect(() => { loadEdges() }, [loadEdges])
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

  // Attaches a video (upload or external link) to an EXISTING verified
  // location. Always lands unverified — same moderation model as new
  // location suggestions. Nothing shows publicly until approveVideo.
  const attachVideo = useCallback(async (locationId, { videoType, videoUrl }) => {
    if (!userId) throw new Error('You need to be signed in to add a video.')
    const { error } = await supabase
      .from('dekut_locations')
      .update({
        video_type: videoType,
        video_url: videoUrl,
        video_uploaded_by: userId,
        is_video_verified: false,
      })
      .eq('id', locationId)
    if (error) throw error
    await Promise.all([loadVerified(), loadPending()])
  }, [userId, loadVerified, loadPending])

  const approveVideo = useCallback(async (locationId) => {
    const { error } = await supabase
      .from('dekut_locations')
      .update({ is_video_verified: true })
      .eq('id', locationId)
    if (error) throw error
    await Promise.all([loadVerified(), loadPending()])
  }, [loadVerified, loadPending])

  const rejectVideo = useCallback(async (locationId) => {
    const { error } = await supabase
      .from('dekut_locations')
      .update({ video_type: 'none', video_url: null, video_uploaded_by: null, is_video_verified: false })
      .eq('id', locationId)
    if (error) throw error
    await loadPending()
  }, [loadPending])
  
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
  
  const deleteLocation = useCallback(async (id) => {
    const { error } = await supabase.from('dekut_locations').delete().eq('id', id)
    if (error) throw error
    await loadVerified()
  }, [loadVerified])
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

  // Admin-only: draw (or remove) a walking-path connection between two
  // verified, placed locations — the only way an edge for route
  // calculation ever comes to exist. locationAId/locationBId order
  // doesn't matter; the DB constraint treats the pair as unordered.
  const connectLocations = useCallback(async (locationAId, locationBId, weight = 1) => {
    if (!userId) throw new Error('You need to be signed in to connect locations.')
    const { error } = await supabase.from('dekut_location_edges').insert({
      location_a_id: locationAId,
      location_b_id: locationBId,
      weight,
      created_by: userId,
    })
    if (error) throw error
    await loadEdges()
  }, [userId, loadEdges])

  const disconnectLocations = useCallback(async (edgeId) => {
    const { error } = await supabase.from('dekut_location_edges').delete().eq('id', edgeId)
    if (error) throw error
    await loadEdges()
  }, [loadEdges])

   return {
    locations, pending, pendingVideos, edges, loading, error,
    submitLocation, approveLocation, rejectLocation, setMapPosition,
    uploadLocationVideo, attachVideo, approveVideo, rejectVideo,
    deleteLocation, connectLocations, disconnectLocations,
    reload: loadVerified,
  }
}
