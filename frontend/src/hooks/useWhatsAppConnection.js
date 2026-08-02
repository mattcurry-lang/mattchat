import { useState, useCallback, useEffect, useRef } from 'react'
import {
  startWhatsAppSignup,
  completeWhatsAppSignup,
  disconnectWhatsApp,
  getWhatsAppAccount,
} from '../lib/supabase'
import { loadFacebookSdk } from '../lib/facebookSdk'

// Same external shape as useInstagramConnection / useTikTokConnection:
//   { status, account, connecting, disconnecting, connect, disconnect, refreshStatus }
// so it drops straight into ConnectedAppsSection the same way — but
// connect() works completely differently under the hood. There's no
// page redirect and no `?whatsapp_connect=success` query param to read
// on return (contrast with ChatPage.jsx's other OAuth-return effects).
// Everything happens inside a popup while the user stays on this page.
export function useWhatsAppConnection(session, userId) {
  const [status, setStatus] = useState('loading') // 'loading' | 'connected' | 'disconnected'
  const [account, setAccount] = useState(null)
  const [connecting, setConnecting] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)
  const [error, setError] = useState(null)

  // Meta posts a window message carrying waba_id/phone_number_id
  // slightly before (or around) FB.login's own callback fires with
  // the auth `code`. We stash whichever arrives first here so the
  // code path below can wait for both.
  const signupDataRef = useRef({})

  const refreshStatus = useCallback(async () => {
    if (!userId) return
    const data = await getWhatsAppAccount(userId)
    if (data && data.status === 'connected') {
      setAccount(data)
      setStatus('connected')
    } else {
      setAccount(null)
      setStatus('disconnected')
    }
  }, [userId])

  useEffect(() => { refreshStatus() }, [refreshStatus])

  useEffect(() => {
    const handler = (event) => {
      if (event.origin !== 'https://www.facebook.com') return
      let data
      try { data = JSON.parse(event.data) } catch { return }
      if (data.type === 'WA_EMBEDDED_SIGNUP' && data.event === 'FINISH') {
        signupDataRef.current.wabaId = data.data?.waba_id
        signupDataRef.current.phoneNumberId = data.data?.phone_number_id
      }
    }
    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
  }, [])

  const connect = useCallback(async () => {
    if (connecting) return
    setConnecting(true)
    setError(null)
    signupDataRef.current = {}

    try {
      const { state, appId, configId } = await startWhatsAppSignup(session)
      const FB = await loadFacebookSdk(appId)

      const code = await new Promise((resolve, reject) => {
        FB.login(
          (response) => {
            if (response.authResponse?.code) resolve(response.authResponse.code)
            else reject(new Error('WhatsApp connection was cancelled.'))
          },
          {
            config_id: configId,
            response_type: 'code',
            override_default_response_type: true,
            extras: { setup: {}, featureType: '', sessionInfoVersion: '3' },
          }
        )
      })

      // Give the postMessage event a brief window to land if it
      // hasn't already — it's a separate channel from FB.login's own
      // callback and isn't guaranteed to arrive in a fixed order.
      for (let i = 0; i < 20; i++) {
        if (signupDataRef.current.wabaId && signupDataRef.current.phoneNumberId) break
        await new Promise((r) => setTimeout(r, 250))
      }

      const { wabaId, phoneNumberId } = signupDataRef.current
      if (!wabaId || !phoneNumberId) {
        throw new Error("Didn't receive WhatsApp account details — please try connecting again.")
      }

      await completeWhatsAppSignup(session, { state, code, wabaId, phoneNumberId })
      await refreshStatus()
    } catch (err) {
      setError(err.message)
      throw err
    } finally {
      setConnecting(false)
    }
  }, [connecting, session, refreshStatus])

  const disconnect = useCallback(async () => {
    setDisconnecting(true)
    try {
      await disconnectWhatsApp(session)
      setAccount(null)
      setStatus('disconnected')
    } finally {
      setDisconnecting(false)
    }
  }, [session])

  return { status, account, connecting, disconnecting, error, connect, disconnect, refreshStatus }
}
