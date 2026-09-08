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
import ExplorePage from './pages/ExplorePage'
import './App.css'
import { unlockFileAudio } from './lib/mattchatSounds'
import TrustedInvitePage from './pages/TrustedInvitePage'
import { MusicPlayerProvider } from './context/MusicPlayerContext'
import MiniPlayer from './components/Pulse/Music/MiniPlayer'

export default function App() {

  const [session, setSession] = useState(undefined)
  const [isRecovery, setIsRecovery] = useState(false)
  const [needsMfa, setNeedsMfa] = useState(false)
  const [aalChecked, setAalChecked] = useState(false)
  const [showFullPlayer, setShowFullPlayer] = useState(false)


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

    let initialSessionHandled = false

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((event, session) => {
     if (event === 'INITIAL_SESSION') initialSessionHandled = true

    if (event === 'PASSWORD_RECOVERY') {
      setIsRecovery(true)
    }

    setSession(session)
    setAalChecked(false)

    if (session) {
      checkAal(session)
    } else {
      setAalChecked(true)
    }
 })

    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        if (initialSessionHandled) return
        setSession(session)
        if (session) checkAal(session)
        else setAalChecked(true)
      })
      .catch((err) => {
        if (initialSessionHandled) return
        console.error('getSession failed:', err)
        setSession(null)
        setAalChecked(true)
     })


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
    <MusicPlayerProvider>
      <BrowserRouter>

        <Routes>

          <Route path="/email/:username" element={<EmailFormPage />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/explore" element={<ExplorePage />} />

          <Route
            path="/"
            element={session ? <ChatPage session={session} /> : <LandingPage />}
          />

          <Route
            path="/auth"
            element={!session ? <AuthPage /> : <Navigate to="/" />}
          />

          <Route
            path="/reset-password"
            element={
              isRecovery
                ? <ResetPasswordPage onDone={() => setIsRecovery(false)} />
                : <Navigate to={session ? "/" : "/auth"} />
            }
          />

          <Route
            path="/app"
            element={session ? <ChatPage session={session} /> : <Navigate to="/" />}
          />

          <Route path="/trusted-invite/:token" element={<TrustedInvitePage session={session} />} />

          <Route
            path="/*"
            element={
              isRecovery
                ? <ResetPasswordPage onDone={() => setIsRecovery(false)} />
                : session
                  ? (needsMfa
                      ? <MfaChallengePage onVerified={() => setNeedsMfa(false)} />
                      : <ChatPage session={session} />)
                  : <Navigate to="/" />
            }
          />

        </Routes>

        {session && (
          <MiniPlayer
            onExpand={() => setShowFullPlayer(true)}
            bottomOffset={60}
          />
        )}

      </BrowserRouter>
    </MusicPlayerProvider>
  )
}
