import React, { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import ConnectedAppCard from './ConnectedAppCard'
import InstagramView from './InstagramView'
import { useInstagramConnection } from '../../hooks/useInstagramConnection'
import {
  connectGoogleDrive, listGoogleDriveAccounts, disconnectGoogleDriveAccount,
  connectGoogleCalendar, listGoogleCalendarAccounts, disconnectGoogleCalendarAccount,
} from '../../lib/supabase'

// Drop this into the profile page:
//   <ConnectedAppsSection session={session} userId={userId} />
export default function ConnectedAppsSection({ session, userId }) {
  const ig = useInstagramConnection(session, userId)
  const [openService, setOpenService] = useState(null) // 'instagram' | 'google_drive' | 'google_calendar' | null
  const [connectError, setConnectError] = useState(null)

  const [driveAccounts, setDriveAccounts] = useState([])
  const [calendarAccounts, setCalendarAccounts] = useState([])
  const [connectingDrive, setConnectingDrive] = useState(false)
  const [connectingCalendar, setConnectingCalendar] = useState(false)
  const [disconnectingDrive, setDisconnectingDrive] = useState(false)
  const [disconnectingCalendar, setDisconnectingCalendar] = useState(false)

  const loadDrive = useCallback(async () => {
    try { setDriveAccounts(await listGoogleDriveAccounts(session)) } catch (e) { console.error('listGoogleDriveAccounts failed:', e) }
  }, [session])
  const loadCalendar = useCallback(async () => {
    try { setCalendarAccounts(await listGoogleCalendarAccounts(session)) } catch (e) { console.error('listGoogleCalendarAccounts failed:', e) }
  }, [session])

  useEffect(() => { loadDrive() }, [loadDrive])
  useEffect(() => { loadCalendar() }, [loadCalendar])

  // These fire from ChatPage's redirect-handling effects once Google
  // sends the browser back — refreshes the list in place instead of
  // requiring a manual reopen of this panel.
  useEffect(() => {
    const onDrive = () => loadDrive()
    const onCalendar = () => loadCalendar()
    window.addEventListener('google-drive-connected', onDrive)
    window.addEventListener('google-calendar-connected', onCalendar)
    return () => {
      window.removeEventListener('google-drive-connected', onDrive)
      window.removeEventListener('google-calendar-connected', onCalendar)
    }
  }, [loadDrive, loadCalendar])

  const handleConnectInstagram = async () => {
    setConnectError(null)
    try {
      await ig.connect() // redirects the page on success
    } catch (e) {
      setConnectError('Could not connect Instagram. Please try again.')
    }
  }

  const handleConnectDrive = async () => {
    if (connectingDrive) return
    setConnectError(null)
    setConnectingDrive(true)
    try {
      await connectGoogleDrive(session) // redirects the page
    } catch (e) {
      setConnectError('Could not connect Google Drive. Please try again.')
      setConnectingDrive(false)
    }
  }

  const handleConnectCalendar = async () => {
    if (connectingCalendar) return
    setConnectError(null)
    setConnectingCalendar(true)
    try {
      await connectGoogleCalendar(session) // redirects the page
    } catch (e) {
      setConnectError('Could not connect Google Calendar. Please try again.')
      setConnectingCalendar(false)
    }
  }

  const handleDisconnectDrive = async (accountId) => {
    setDisconnectingDrive(true)
    try {
      await disconnectGoogleDriveAccount(session, accountId)
      await loadDrive()
    } catch (e) {
      setConnectError('Could not disconnect Google Drive.')
    }
    setDisconnectingDrive(false)
  }

  const handleDisconnectCalendar = async (accountId) => {
    setDisconnectingCalendar(true)
    try {
      await disconnectGoogleCalendarAccount(session, accountId)
      await loadCalendar()
    } catch (e) {
      setConnectError('Could not disconnect Google Calendar.')
    }
    setDisconnectingCalendar(false)
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
    {
      id: 'google_drive',
      label: 'Google Drive',
      icon: '📁',
      connected: driveAccounts.length > 0,
      username: driveAccounts[0]?.email_address,
    },
    {
      id: 'google_calendar',
      label: 'Google Calendar',
      icon: '📅',
      connected: calendarAccounts.length > 0,
      username: calendarAccounts[0]?.email_address,
    },
    { id: 'tiktok', label: 'TikTok', icon: '🎵', connected: false, comingSoon: true },
    { id: 'youtube', label: 'YouTube', icon: '▶️', connected: false, comingSoon: true },
    { id: 'x', label: 'X', icon: '𝕏', connected: false, comingSoon: true },
  ]

  const onConnectFor = {
    instagram: handleConnectInstagram,
    google_drive: handleConnectDrive,
    google_calendar: handleConnectCalendar,
  }
  const busyFor = {
    instagram: ig.connecting,
    google_drive: connectingDrive,
    google_calendar: connectingCalendar,
  }

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

  // Drive/Calendar don't have a dedicated full-page view yet (no data
  // browsing built for them in Pulse beyond the plugin itself) — so
  // "opening" one just expands a small inline account list with a
  // disconnect action, rather than navigating to a new screen.
  if (openService === 'google_drive' || openService === 'google_calendar') {
    const isDrive = openService === 'google_drive'
    const accounts = isDrive ? driveAccounts : calendarAccounts
    const disconnecting = isDrive ? disconnectingDrive : disconnectingCalendar
    const handleDisconnect = isDrive ? handleDisconnectDrive : handleDisconnectCalendar
    return (
      <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={() => setOpenService(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 16, padding: 0 }}>←</button>
          <h3 style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
            {isDrive ? 'Google Drive' : 'Google Calendar'}
          </h3>
        </div>
        {accounts.map(acc => (
          <div key={acc.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 12, background: 'var(--bg-surface-2)', border: '1px solid var(--border)' }}>
            <div style={{ flex: 1, fontSize: 13, color: 'var(--text-primary)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {acc.email_address}
            </div>
            <button
              onClick={() => handleDisconnect(acc.id)}
              disabled={disconnecting}
              style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 20, color: '#f87171', fontSize: 11.5, fontWeight: 700, padding: '5px 12px', cursor: disconnecting ? 'default' : 'pointer', fontFamily: 'inherit', opacity: disconnecting ? 0.6 : 1 }}
            >
              {disconnecting ? 'Removing…' : 'Disconnect'}
            </button>
          </div>
        ))}
        <button
          onClick={isDrive ? handleConnectDrive : handleConnectCalendar}
          disabled={isDrive ? connectingDrive : connectingCalendar}
          style={{ background: 'linear-gradient(135deg,#667eea,#764ba2)', border: 'none', borderRadius: 12, color: '#fff', fontSize: 13, fontWeight: 700, padding: '10px 14px', cursor: 'pointer', fontFamily: 'inherit' }}
        >
          {(isDrive ? connectingDrive : connectingCalendar) ? 'Connecting…' : `Connect another ${isDrive ? 'Drive' : 'Calendar'} account`}
        </button>
      </motion.div>
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
          busy={busyFor[service.id]}
          onConnect={onConnectFor[service.id]}
          onOpen={() => setOpenService(service.id)}
        />
      ))}
    </motion.div>
  )
}
