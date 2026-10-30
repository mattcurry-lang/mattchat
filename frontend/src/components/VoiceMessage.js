import React, { useMemo, useState } from 'react'
import './VoiceNotes.css'
import { Icon, VoiceWave, useAudioPlayer, fmt, seededPeaks, normalizePeaks } from './voiceShared'

export default function VoiceMessage({ message, isMe }) {
  const [showTranscript, setShowTranscript] = useState(false)

  // real waveform if the recorder stored one (audio_waveform), otherwise a stable one from the message id
  const peaks = useMemo(
    () => normalizePeaks(message.audio_waveform) || seededPeaks(String(message.id || ''), 40),
    [message.id, message.audio_waveform]
  )

  const player = useAudioPlayer(message.audio_url, Number(message.audio_duration) || 0)

  const hasTranscript = !!message.transcript
  const transcribing =
    !hasTranscript && (message.transcript_status === 'pending' || message.transcript_status === 'processing')
  const active = player.playing || player.progress > 0
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

      {hasTranscript && (
        <>
          <button
            type="button"
            className="vn-txbtn"
            onClick={() => setShowTranscript(v => !v)}
            aria-expanded={showTranscript}
          >
            <Icon name="lines" size={14} />
            Transcript
            <Icon name="chevron" size={14} className="chev" />
          </button>
          <div className={`vn-tx${showTranscript ? ' is-open' : ''}`}>
            <div><p>{message.transcript}</p></div>
          </div>
        </>
      )}

      {transcribing && (
        <div className="vn-decode" role="status">
          <span className="vn-spinner" />
          <span className="vn-shimmer">Transcribing…</span>
        </div>
      )}
    </div>
  )
}
