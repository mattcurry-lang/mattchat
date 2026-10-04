import { MusicProvider, makeTrackId } from '../MusicProvider'

const BASE = 'https://api.jamendo.com/v3.0'
const CLIENT_ID = process.env.REACT_APP_JAMENDO_CLIENT_ID

async function jamendo(path, params = {}) {
  const qs = new URLSearchParams({
    client_id: CLIENT_ID, format: 'json', imagesize: '300', audioformat: 'mp32', ...params,
  }).toString()
  const res = await fetch(`${BASE}${path}?${qs}`)
  if (!res.ok) throw new Error(`Jamendo responded ${res.status}`)
  const json = await res.json()
  return json.results || []
}

function normalizeTrack(t) {
  return {
    id: makeTrackId('jamendo', t.id),
    provider: 'jamendo',
    providerTrackId: t.id,
    title: t.name,
    artist: t.artist_name || 'Unknown artist',
    artistId: t.artist_id || null,
    album: t.album_name || null,
    artwork: t.image || t.album_image || null,
    duration: Number(t.duration) || 0,
    streamUrl: t.audio || null,
    downloadUrl: t.audiodownload || null,
    isDownloadable: Boolean(t.audiodownload_allowed && t.audiodownload),
    license: t.license_ccurl || null,
  }
}

export class JamendoProvider extends MusicProvider {
  key = 'jamendo'

  async search(query, { limit = 15 } = {}) {
    if (!query?.trim()) return { tracks: [], artists: [], albums: [] }
    const rows = await jamendo('/tracks/', { search: query, limit: String(limit) })
    return { tracks: rows.map(normalizeTrack), artists: [], albums: [] }
  }
  async searchTracks(query, opts) { return (await this.search(query, opts)).tracks }
  async searchArtists() { return [] }
  async searchAlbums() { return [] }
  async getArtist() { return null }
  async getAlbum() { return null }

  async getTrack(id) {
    const rows = await jamendo('/tracks/', { id: String(id) })
    return rows[0] ? normalizeTrack(rows[0]) : null
  }

  async getTrending({ limit = 20 } = {}) {
    const rows = await jamendo('/tracks/', { order: 'popularity_week', limit: String(limit) })
    return rows.map(normalizeTrack)
  }

  async streamTrack(id) {
    const t = await this.getTrack(id)
    return t?.streamUrl || null
  }

  async getDownloadUrl(track) {
    if (track.downloadUrl) return track.downloadUrl
    const t = await this.getTrack(track.providerTrackId)
    return t?.isDownloadable ? t.downloadUrl : null
  }
}

export const jamendoProvider = new JamendoProvider()
