import React, { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import './VoiceNotes.css'
import { Icon, VoiceWave, useAudioPlayer, fmt, seededPeaks, normalizePeaks } from './voiceShared'

const BUCKET = 'voice-notes'

// "https://x.supabase.co/storage/v1/object/public/voice-notes/user/123.webm" -> "user/123.webm"
function storagePath(url = '') {
  const part = url.split(`/${BUCKET}/`)[1]
  return part ? decodeURIComponent(part.split('?')[0]) : null
}

export default function VoiceMessage({ message, isMe }) {
  const [src, setSrc] = useState(message.audio_url)
  const triedSigned = useRef(false)
  const retryPlay = useRef(false)

  useEffect(() => {
    setSrc(message.audio_url)
    triedSigned.current = false
  }, [message.audio_url])

  // real waveform if the recorder stored one (audio_waveform), otherwise a stable one from the message id
  const peaks = useMemo(
    () => normalizePeaks(message.audio_waveform) || seededPeaks(String(message.id || ''), 40),
    [message.id, message.audio_waveform]
  )

  const player = useAudioPlayer(src, Number(message.audio_duration) || 0)

  // If the public URL doesn't load (for example the bucket is private), try a signed URL once.
  useEffect(() => {
    if (!player.failed || triedSigned.current) return
    triedSigned.current = true
    const path = storagePath(message.audio_url)
    if (!path) return
    supabase.storage.from(BUCKET).createSignedUrl(path, 3600).then(({ data, error }) => {
      if (error) { console.error('voice note signed URL failed:', error); return }
      if (data?.signedUrl) { retryPlay.current = true; setSrc(data.signedUrl) }
    })
  }, [player.failed])

  // ...then play it automatically so the tap isn't wasted
  useEffect(() => {
    if (retryPlay.current && src !== message.audio_url) {
      retryPlay.current = false
      player.toggle()
    }
  }, [src])

  const active = player.playing || player.current > 0
  const shown = active ? player.current : player.duration

  return (
    <div className={`vn vn-card ${isMe ? 'is-me' : 'is-them'}`}>
      <div className="vn-row">
        <button
          type="button"
          className={`vn-play is-lg${player.playing ? ' is-on' : ''}`}
          onClick={player.toggle}
          aria-label={player.playing ? 'Pause voice note' : 'Play voice note'}
        >
          <span className="vn-ring" />
          <Icon name={player.playing ? 'pause' : 'play'} size={20} />
        </button>

        <div className="vn-col">
          <VoiceWave peaks={peaks} progress={player.progress} playing={player.playing} onSeek={player.seek} />
          <div className="vn-meta">
            <span className={`vn-time${active ? ' is-live' : ''}`}>{fmt(shown)}</span>
            <button
              type="button"
              className="vn-rate"
              onClick={player.cycleRate}
              aria-label={`Playback speed ${player.rate} times. Tap to change.`}
            >
              {player.rate}×
            </button>
          </div>
        </div>
      </div>

      {player.failed && <div className="vn-fail" role="alert">Can't play this voice note.</div>}
    </div>
  )
}
