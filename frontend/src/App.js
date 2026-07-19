import React, { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { supabase } from './lib/supabase'
import ChatPage from './pages/ChatPage'
import AuthPage from './pages/AuthPage'
import EmailFormPage from './pages/EmailFormPage'
import ResetPasswordPage from './pages/ResetPasswordPage'
import MfaChallengePage from './pages/MfaChallengePage'
import './App.css'
import Privacy from './pages/Privacy'
export default function App() {
  const [session, setSession] = useState(undefined)
  const [isRecovery, setIsRecovery] = useState(false)
  const [needsMfa, setNeedsMfa] = useState(false)
  const [aalChecked, setAalChecked] = useState(false)

  // Browsers block audio until the user has interacted with the page at
  // least once. This primes a silent play+pause on the very first
  // click/tap anywhere in the app so later programmatic playback
  // (notification ping, incoming-call ringtone) isn't blocked.
  useEffect(() => {
    const unlockAudio = () => {
      try {
        const el = new Audio('/sounds/notification.wav')
        el.volume = 0
        el.play().then(() => {
          el.pause()
          el.currentTime = 0
        }).catch(() => {})
      } catch (e) {
        // ignore — worst case, first sound is silently blocked and
        // subsequent ones work once a gesture does succeed
      }
    }
    window.addEventListener('pointerdown', unlockAudio, { once: true })
    return () => window.removeEventListener('pointerdown', unlockAudio)
  }, [])

  // A signed-in session from Supabase can still be "aal1" even when the
  // account has a verified 2FA factor — Supabase issues the session
  // right after password auth, then expects the app to separately
  // enforce the step-up to aal2 via a challenge. This is that check
  const checkAal = async () => {
    const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
    if (!error && data) {
      setNeedsMfa(data.nextLevel === 'aal2' && data.currentLevel !== data.nextLevel)
    } else {
      setNeedsMfa(false)
    }
    setAalChecked(true)
  }
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session) checkAal(); else setAalChecked(true)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      // Supabase fires this specific event when the session came from a
      // password-reset link — NOT from a normal sign-in. We latch this
      // in state (not just checking the URL) because the event only
      // fires once, right when the link is clicked; by the time the
      // component re-renders on navigation we'd otherwise lose it.
      if (event === 'PASSWORD_RECOVERY') {
        setIsRecovery(true)
      }
      setSession(session)
      setAalChecked(false)
      if (session) checkAal(); else setAalChecked(true)
    })
    return () => subscription.unsubscribe()
  }, [])
  if (session === undefined || !aalChecked) {
    return (
      <div className="splash">
        <img src="/logo.png" alt="Mattchat" className="splash-logo-img" />
      </div>
    )
  }
  return (
    <BrowserRouter>
      <Routes>
        {/* Public email contact form — no login needed */}
       <Route path="/email/:username" element={<EmailFormPage />} />
  <Route path="/privacy" element={<Privacy />} />
        <Route path="/auth" element={!session ? <AuthPage /> : <Navigate to="/" />} />
        {/* Recovery session takes priority over the normal session check —
            otherwise a recovery session (which IS a real session) would
            fall through to ChatPage instead of letting them set a new password. */}
        <Route
          path="/reset-password"
          element={
            isRecovery
              ? <ResetPasswordPage onDone={() => setIsRecovery(false)} />
              : <Navigate to={session ? '/' : '/auth'} />
          }
        />
        <Route
          path="/*"
          element={
            isRecovery
              ? <Navigate to="/reset-password" />
              : session
                ? (needsMfa
                    ? <MfaChallengePage onVerified={() => setNeedsMfa(false)} />
                    : <ChatPage session={session} />)
                : <Navigate to="/auth" />
          }
        />
      </Routes>
    </BrowserRouter>
  )
}
