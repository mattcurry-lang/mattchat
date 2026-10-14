import React from 'react'

/** Three animated bars — the "this is playing" marker Spotify and Boomplay both use. */
export default function Equalizer({ playing = true, color = '#fff', size = 14 }) {
  const bar = (delay, dur) => ({
    width: 3, height: '100%', borderRadius: 2, background: color, transformOrigin: 'bottom',
    animation: `mc-eq ${dur}s ease-in-out ${delay}s infinite`,
    animationPlayState: playing ? 'running' : 'paused',
  })
  return (
    <span aria-hidden style={{ display: 'inline-flex', alignItems: 'flex-end', gap: 2, height: size, width: size }}>
      <style>{`@keyframes mc-eq{0%,100%{transform:scaleY(.25)}50%{transform:scaleY(1)}}`}</style>
      <i style={bar(0, 0.9)} /><i style={bar(0.2, 0.7)} /><i style={bar(0.1, 1.1)} />
    </span>
  )
}
