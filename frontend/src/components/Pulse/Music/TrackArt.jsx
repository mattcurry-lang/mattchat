import React, { useState, useEffect } from 'react'
import { IconMusic } from '../../Icons'
import { isLetterboxed, LETTERBOX_ZOOM } from '../../../lib/music/artwork'

export default function TrackArt({ src, size, radius = 10, iconSize = 16, style, imgStyle }) {
  const [failed, setFailed] = useState(false)
  useEffect(() => { setFailed(false) }, [src])
  const crop = isLetterboxed(src)
  return (
    <div style={{
      width: size, height: size, borderRadius: radius, overflow: 'hidden', flexShrink: 0,
      background: 'rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'center',
      ...style,
    }}>
      {src && !failed ? (
        <img
          src={src} alt="" draggable={false} onError={() => setFailed(true)}
          style={{
            width: '100%', height: '100%', objectFit: 'cover', display: 'block',
            transform: crop ? `scale(${LETTERBOX_ZOOM})` : undefined, ...imgStyle,
          }}
        />
      ) : (
        <IconMusic size={iconSize} style={{ color: 'rgba(255,255,255,0.45)' }} />
      )}
    </div>
  )
}
