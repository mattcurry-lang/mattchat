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

   // Supabase's supabase-js v2 already fires an INITIAL_SESSION event
    // through onAuthStateChange as soon as it subscribes, carrying
    // whatever session currently exists — so a separate getSession()
    // call here is redundant AND dangerous: it's a promise that can
    // resolve AFTER a real SIGNED_IN event has already landed (e.g. the
    // user signs in while this initial fetch is still in flight), and
    // when it resolves late it overwrites the correct session with the
    // stale pre-login value it captured at call time. That's what was
    // bouncing people back to the landing page right after a successful
    // sign-in. `initialSessionHandled` makes sure this stale write is
    // ignored once a real event has already updated auth state.
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
      checkAal(session)   // ← pass session in
    } else {
      setAalChecked(true)
    }
 })
// Fallback only: if for some reason INITIAL_SESSION never fires
    // (older supabase-js, edge cases), still resolve the splash screen
    // — but never let this overwrite a session that a real auth event
    // has already set.
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

        <Route
          path="/explore"
          element={<ExplorePage />}
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
<Route path="/trusted-invite/:token" element={<TrustedInvitePage session={session} />} />
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

            : <Navigate to="/" />

          }
        />


      </Routes>

    </BrowserRouter>

  )
}
