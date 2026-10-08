import React, { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { supabase } from './lib/supabase'
import ChatPage from './pages/ChatPage'
import './App.css'
import { unlockFileAudio } from './lib/mattchatSounds'
import { MusicPlayerProvider } from './components/context/MusicPlayerContext'
import MiniPlayer from './components/Pulse/Music/MiniPlayer'
import { readStoredSession, storedSessionNeedsMfa } from './lib/offlineSession'
import { isOnlineNow } from './lib/connectivity'
import ShushhhInviteListener from './components/Shushhh/ShushhhInviteListener'
// Loaded only when someone actually visits them
const AuthPage = lazy(() => import('./pages/AuthPage'))
const EmailFormPage = lazy(() => import('./pages/EmailFormPage'))
const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage'))
const MfaChallengePage = lazy(() => import('./pages/MfaChallengePage'))
const LandingPage = lazy(() => import('./components/Landing/LandingPage'))
const Privacy = lazy(() => import('./pages/Privacy'))
const Terms = lazy(() => import('./pages/Terms'))
const ExplorePage = lazy(() => import('./pages/ExplorePage'))
const TrustedInvitePage = lazy(() => import('./pages/TrustedInvitePage'))

const withTimeout = (promise, ms) =>
  Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms))])

function Splash() {
  return (
    <div style={{
      position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 16,
      background: 'linear-gradient(180deg,#0f0f1a 0%,#1a1a2e 100%)',
    }}>
      <img src="/logo.png" alt="Mattchat" style={{ width: 96, height: 96, animation: 'splashPulse 1.8s ease-in-out infinite' }} />
      <div style={{
        fontSize: 20, fontWeight: 800, color: '#fff', letterSpacing: '-0.02em',
        background: 'linear-gradient(135deg,#667eea,#764ba2)',
        WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
      }}>
        Mattchat
      </div>
      <style>{`@keyframes splashPulse { 0%, 100% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.08); opacity: 0.75; } }`}</style>
    </div>
  )
}

export default function App() {
  // Start from the login saved on this device, so the app appears instantly
  const [session, setSession] = useState(() => readStoredSession() ?? undefined)
  const [isRecovery, setIsRecovery] = useState(false)
  const [needsMfa, setNeedsMfa] = useState(() => {
    const s = readStoredSession()
    return s ? storedSessionNeedsMfa(s) : false
  })
  const [aalChecked, setAalChecked] = useState(() => Boolean(readStoredSession()))
  const sessionRef = useRef(session)

  useEffect(() => {
    window.addEventListener('pointerdown', unlockFileAudio, { once: true })
    return () => window.removeEventListener('pointerdown', unlockFileAudio)
  }, [])

  const checkAal = async (currentSession) => {
    if (!currentSession?.user) { setNeedsMfa(false); setAalChecked(true); return }
    if (!isOnlineNow()) { setAalChecked(true); return } // offline: trust what the saved login says
    try {
      const { data, error } = await withTimeout(supabase.auth.mfa.getAuthenticatorAssuranceLevel(), 4000)
      if (!error && data) setNeedsMfa(data.nextLevel === 'aal2' && data.currentLevel !== data.nextLevel)
    } catch (e) {
      console.error('checkAal failed:', e) // keep the current answer instead of hanging
    }
    setAalChecked(true)
  }

  useEffect(() => {
    const useSaved = () => {
      const saved = readStoredSession()
      if (!saved) return false
      sessionRef.current = saved
      setSession(saved)
      setNeedsMfa(storedSessionNeedsMfa(saved))
      setAalChecked(true)
      return true
    }

    // Never leave anyone stuck on the splash on a slow or dead connection
    const splashGuard = setTimeout(() => {
      if (sessionRef.current === undefined) {
        if (!useSaved()) { sessionRef.current = null; setSession(null) }
        setAalChecked(true)
      }
    }, 5000)

    let initialHandled = false

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (event === 'INITIAL_SESSION') initialHandled = true
      if (event === 'PASSWORD_RECOVERY') setIsRecovery(true)

      // Offline, Supabase can't refresh the token and reports "no session". That isn't a sign-out.
      if (!newSession && event !== 'SIGNED_OUT' && !isOnlineNow() && useSaved()) return

      const hadSession = Boolean(sessionRef.current)
      sessionRef.current = newSession
      setSession(newSession)

      if (newSession) {
        if (!hadSession) setAalChecked(false) // splash only for a first sign-in, not on token refreshes
        checkAal(newSession)
      } else {
        setNeedsMfa(false)
        setAalChecked(true)
      }
    })

    supabase.auth.getSession()
      .then(({ data: { session: s } }) => {
        if (initialHandled) return
        if (!s && !isOnlineNow() && useSaved()) return
        sessionRef.current = s
        setSession(s)
        if (s) checkAal(s)
        else setAalChecked(true)
      })
      .catch((err) => {
        if (initialHandled) return
        console.error('getSession failed:', err)
        if (!useSaved()) { sessionRef.current = null; setSession(null) }
        setAalChecked(true)
      })

    return () => { clearTimeout(splashGuard); subscription.unsubscribe() }
  }, []) 

  if (session === undefined || !aalChecked) return <Splash />

  return (
    <MusicPlayerProvider session={session}>
      <BrowserRouter>
        <Suspense fallback={<Splash />}>
          <Routes>
            <Route path="/email/:username" element={<EmailFormPage />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/terms" element={<Terms />} />
            <Route path="/explore" element={<ExplorePage />} />

            <Route path="/" element={session ? <ChatPage session={session} /> : <LandingPage />} />
            <Route path="/auth" element={!session ? <AuthPage /> : <Navigate to="/" />} />

            <Route
              path="/reset-password"
              element={
                isRecovery
                  ? <ResetPasswordPage onDone={() => setIsRecovery(false)} />
                  : <Navigate to={session ? '/' : '/auth'} />
              }
            />

            <Route path="/app" element={session ? <ChatPage session={session} /> : <Navigate to="/" />} />
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
        </Suspense>

        {session && <MiniPlayer bottomOffset={60} />}

        {/* Shushhh: listens for incoming temporary-room invites (in-memory only, nothing persisted) */}
        {session?.user?.id && !needsMfa && <ShushhhInviteListener me={session.user.id} />}
      </BrowserRouter>
    </MusicPlayerProvider>
  )
}
