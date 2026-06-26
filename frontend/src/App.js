import React, { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { supabase } from './lib/supabase'
import ChatPage from './pages/ChatPage'
import AuthPage from './pages/AuthPage'
import EmailFormPage from './pages/EmailFormPage'
import './App.css'

export default function App() {
  const [session, setSession] = useState(undefined)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setSession(session)
    })
    return () => subscription.unsubscribe()
  }, [])

  if (session === undefined) {
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

        <Route path="/auth" element={!session ? <AuthPage /> : <Navigate to="/" />} />
        <Route path="/*" element={session ? <ChatPage session={session} /> : <Navigate to="/auth" />} />
      </Routes>
    </BrowserRouter>
  )
}
