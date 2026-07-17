import React, { useState } from 'react'
import { motion } from 'framer-motion'
import ConnectedAppCard from './ConnectedAppCard'
import InstagramView from './InstagramView'
import { useInstagramConnection } from '../../hooks/useInstagramConnection'

// Drop this into the profile page:
//   <ConnectedAppsSection session={session} userId={userId} />
export default function ConnectedAppsSection({ session, userId }) {
  const ig = useInstagramConnection(session, userId)
  const [openService, setOpenService] = useState(null) // 'instagram' | null
  const [connectError, setConnectError] = useState(null)

  const handleConnectInstagram = async () => {
    setConnectError(null)
    try {
      await ig.connect() // redirects the page on success
    } catch (e) {
      setConnectError('Could not connect Instagram. Please try again.')
    }
  }

  const services = [
    {
      id: 'instagram',
      label: 'Instagram',
      icon: '📷',
      connected: ig.status === 'connected',
      username: ig.account?.username,
      avatarUrl: ig.account?.avatar_url,
    },
    { id: 'tiktok', label: 'TikTok', icon: '🎵', connected: false, comingSoon: true },
    { id: 'youtube', label: 'YouTube', icon: '▶️', connected: false, comingSoon: true },
    { id: 'x', label: 'X', icon: '𝕏', connected: false, comingSoon: true },
  ]

  if (openService === 'instagram') {
    return (
      <InstagramView
        session={session}
        account={ig.account}
        status={ig.status}
        onDisconnect={ig.disconnect}
        disconnecting={ig.disconnecting}
        onClose={() => setOpenService(null)}
      />
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      style={{ display: 'flex', flexDirection: 'column', gap: 10 }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <h3 style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>Connected Apps</h3>
        <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
          {services.filter((s) => s.connected).length} connected
        </span>
      </div>

      {ig.account?.status === 'expired' && (
        <div style={{ fontSize: 12, color: '#fbbf24', background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.25)', borderRadius: 10, padding: '8px 12px' }}>
          Your Instagram connection expired. Reconnect to keep using it in Mattchat.
        </div>
      )}
      {connectError && (
        <div style={{ fontSize: 12, color: '#f87171', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 10, padding: '8px 12px' }}>
          {connectError}
        </div>
      )}

      {services.map((service) => (
        <ConnectedAppCard
          key={service.id}
          service={service}
          busy={service.id === 'instagram' && ig.connecting}
          onConnect={service.id === 'instagram' ? handleConnectInstagram : undefined}
          onOpen={() => setOpenService(service.id)}
        />
      ))}
    </motion.div>
  )
}
