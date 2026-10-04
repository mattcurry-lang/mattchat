import { MattchatProvider } from './providers/MattchatProvider'
import { audiusProvider } from './providers/AudiusProvider'
import { jamendoProvider } from './providers/JamendoProvider'

export async function getDownloadUrl(track) {
  switch (track.provider) {
    case 'mattchat': return MattchatProvider.getDownloadUrl(track)
    case 'audius':   return audiusProvider.getDownloadUrl(track)
    case 'jamendo':  return jamendoProvider.getDownloadUrl(track)
    default:         return null   // YouTube etc.: never downloadable
  }
}
