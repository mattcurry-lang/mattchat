import { MattchatProvider } from './providers/MattchatProvider'
import { audiusProvider } from './providers/AudiusProvider'
import { jamendoProvider } from './providers/JamendoProvider'

// Given any track, returns more tracks by the same artist from the same source
export async function getArtistTracks(track) {
  switch (track.provider) {
    case 'mattchat': return MattchatProvider.getArtistTracks(track.artistId)
    case 'audius':   return audiusProvider.getArtistTracks(track.artistId)
    case 'jamendo':  return jamendoProvider.getArtistTracks(track.artistId)
    default:         return []   // YouTube etc.: never
  }
}
