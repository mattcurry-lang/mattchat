import React from 'react'

// The WhatsApp glyph itself (phone handset inside a speech bubble),
// no background shape — colors via currentColor so it can sit inside
// any gradient/solid button and match Mattchat's theme instead of
// WhatsApp's own green, per the "recognizable but blended in" brief.
// Used by WhatsAppView, WhatsAppPage's sidebar header, and the
// top-header entry-point button.
export default function WhatsAppIcon({ size = 22, className, style }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={style}
    >
      <path
        fill="currentColor"
        d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.46 1.32 4.96L2.05 22l5.25-1.38a9.87 9.87 0 0 0 4.74 1.21h.01c5.46 0 9.9-4.45 9.9-9.91C21.96 6.45 17.5 2 12.04 2zm5.8 14.02c-.24.68-1.4 1.3-1.94 1.38-.5.08-1.12.11-1.8-.11-.42-.13-.95-.3-1.63-.6-2.87-1.24-4.74-4.13-4.88-4.32-.14-.19-1.17-1.55-1.17-2.96s.72-2.1.98-2.39c.24-.27.53-.34.71-.34.18 0 .35 0 .5.01.16.01.38-.06.59.45.24.58.81 1.99.88 2.13.07.14.11.31.02.5-.09.19-.14.31-.27.48-.14.16-.29.36-.41.48-.14.14-.28.28-.12.55.16.27.71 1.17 1.52 1.9 1.05.94 1.93 1.23 2.2 1.37.27.14.43.11.59-.07.16-.18.68-.79.86-1.06.18-.27.36-.22.6-.13.24.09 1.55.73 1.82.86.27.13.45.2.51.31.07.11.07.61-.17 1.3z"
      />
    </svg>
  )
}
