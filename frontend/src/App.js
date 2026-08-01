import React, { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { supabase } from './lib/supabase'

import ChatPage from './pages/ChatPage'
import AuthPage from './pages/AuthPage'
import EmailFormPage from './pages/EmailFormPage'
import ResetPasswordPage from './pages/ResetPasswordPage'
import MfaChallengePage from './pages/MfaChallengePage'
import LandingPage from './components/Landing/LandingPage'

import Privacy from './pages/Privacy'
import Terms from './pages/Terms'

import './App.css'
import { unlockFileAudio } from './lib/mattchatSounds'


export default function App() {

  const [session, setSession] = useState(undefined)
  const [isRecovery, setIsRecovery] = useState(false)
  const [needsMfa, setNeedsMfa] = useState(false)
  const [aalChecked, setAalChecked] = useState(false)


  useEffect(() => {
    window.addEventListener('pointerdown', unlockFileAudio, { once: true })

    return () => {
      window.removeEventListener('pointerdown', unlockFileAudio)
    }
  }, [])


 const checkAal = async (currentSession) => {
  if (!currentSession?.user) {
    setNeedsMfa(false)
    setAalChecked(true)
    return
  }

  try {
    const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
    if (!error && data) {
      setNeedsMfa(
        data.nextLevel === 'aal2' &&
        data.currentLevel !== data.nextLevel
      )
    } else {
      setNeedsMfa(false)
    }
  } catch (e) {
    console.error('checkAal failed:', e)
    setNeedsMfa(false)
  }

  setAalChecked(true)
}

  useEffect(() => {

    supabase.auth.getSession()
  .then(({ data: { session } }) => {
    setSession(session)

    if (session) {
      checkAal(session)   // ← pass session in
    } else {
      setAalChecked(true)
    }
  })

    .catch((err) => {
   console.error('getSession failed:', err)
     setSession(null)
     setAalChecked(true)
   })


   const {
  data: { subscription }
} = supabase.auth.onAuthStateChange(
  (event, session) => {

    if (event === 'PASSWORD_RECOVERY') {
      setIsRecovery(true)
    }

    setSession(session)
    setAalChecked(false)

    if (session) {
      checkAal(session)   // ← pass session in
    } else {
      setAalChecked(true)
    }
  }
)

    return () => subscription.unsubscribe()

  }, [])



if (session === undefined || !aalChecked) {
  return (
    <div style={{
      position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 16,
      background: 'linear-gradient(180deg,#0f0f1a 0%,#1a1a2e 100%)',
    }}>
      <img
        src="/logo.png"
        alt="Mattchat"
        style={{ width: 96, height: 96, animation: 'splashPulse 1.8s ease-in-out infinite' }}
      />
      <div style={{
        fontSize: 20, fontWeight: 800, color: '#fff', letterSpacing: '-0.02em',
        background: 'linear-gradient(135deg,#667eea,#764ba2)',
        WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
      }}>
        Mattchat
      </div>
      <style>{`
        @keyframes splashPulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.08); opacity: 0.75; }
        }
      `}</style>
    </div>
  )
}


  return (

    <BrowserRouter>

      <Routes>


        {/* Email profile links */}
        <Route
          path="/email/:username"
          element={<EmailFormPage />}
        />


        {/* Legal pages */}
        <Route
          path="/privacy"
          element={<Privacy />}
        />

        <Route
          path="/terms"
          element={<Terms />}
        />


        {/* Landing page */}
      <Route
  path="/"
  element={
    session
      ? <ChatPage session={session} />
      : <LandingPage />
  }
/>


        {/* Authentication */}
        <Route
          path="/auth"
          element={
            !session
            ? <AuthPage />
            : <Navigate to="/" />
          }
        />


        {/* Password reset */}
        <Route
          path="/reset-password"
          element={
            isRecovery
            ? (
              <ResetPasswordPage
                onDone={() => setIsRecovery(false)}
              />
            )
            : (
              <Navigate
                to={session ? "/" : "/auth"}
              />
            )
          }
        />
<Route
    path="/app"
    element={
        session
        ? <ChatPage session={session}/>
        : <Navigate to="/" />
    }
/>

        {/* Main app */}
        <Route
          path="/*"
          element={
            isRecovery
            ?
            <ResetPasswordPage
              onDone={() => setIsRecovery(false)}
            />

            :

            session

            ?

            (
              needsMfa

              ?

              <MfaChallengePage
                onVerified={() => setNeedsMfa(false)}
              />

              :

            <ChatPage session={session} />

            )

            :

            <Navigate to="/welcome" />

          }
        />


      </Routes>

    </BrowserRouter>

  )
}
