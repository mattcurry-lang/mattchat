import { MattchatProvider } from './providers/MattchatProvider'
 

// Given any track, returns more tracks by the same artist from the same source
export async function getArtistTracks(track) {
  switch (track.provider) {
    case 'mattchat': return MattchatProvider.getArtistTracks(track.artistId)
    
    default:         return []   // YouTube etc.: never
  }
}
