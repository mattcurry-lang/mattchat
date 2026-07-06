import React from 'react'

// hasStatus=false -> no ring (plain avatar, e.g. "add status" with nothing posted yet)
// hasStatus=true, viewed=false -> glowing purple/pink ring (unviewed — the whole point of this component)
// hasStatus=true, viewed=true  -> dim grey ring (seen already)
export default function StatusRing({ size = 58, hasStatus, viewed, children }) {
  const cls = !hasStatus ? 'status-ring-none' : viewed ? 'status-ring-viewed' : 'status-ring-active'
  return (
    <div className={`status-ring-wrap ${cls}`} style={{ width: size, height: size }}>
      <div className="status-ring-inner">{children}</div>
    </div>
  )
}
