import React, { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { supabase } from './lib/supabase'
import ChatPage from './pages/ChatPage'
import AuthPage from './pages/AuthPage'
import EmailFormPage from './pages/EmailFormPage'
import ResetPasswordPage from './pages/ResetPasswordPage'
import MfaChallengePage from './pages/MfaChallengePage'
import LandingPage from './components/Landing/LandingPage'
import './App.css'
import Privacy from './pages/Privacy'
import { unlockFileAudio } from './lib/mattchatSounds'
export default function App() {
  const [session, setSession] = useState(undefined)
  const [isRecovery, setIsRecovery] = useState(false)
  const [needsMfa, setNeedsMfa] = useState(false)
  const [aalChecked, setAalChecked] = useState(false)

  useEffect(() => {
    window.addEventListener('pointerdown', unlockFileAudio, { once: true })
    return () => window.removeEventListener('pointerdown', unlockFileAudio)
  }, [])

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
        <Route path="/email/:username" element={<EmailFormPage />} />
        <Route path="/privacy" element={<Privacy />} />
        {/* New visitors land here first instead of going straight to
            the login form — "Get Started" on this page is what sends
            them to /auth. */}
        <Route path="/welcome" element={!session ? <LandingPage /> : <Navigate to="/" />} />
        <Route path="/auth" element={!session ? <AuthPage /> : <Navigate to="/" />} />
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
                : <Navigate to="/welcome" />
          }
        />
      </Routes>
    </BrowserRouter>
  )
}
