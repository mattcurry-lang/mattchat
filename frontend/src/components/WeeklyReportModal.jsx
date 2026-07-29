import React, { useState, useEffect } from 'react'
import { getWeeklyReport } from '../lib/supabase'
import { IconX, IconCheckSquare, IconClock, IconChart, IconStar, IconAlertTriangle, IconLightbulb } from './Icons'

export default function WeeklyReportModal({ session, onClose }) {
  const [report, setReport] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getWeeklyReport(session).then((res) => { if (res.ok) setReport(res.report) }).finally(() => setLoading(false))
  }, [session])

  return (
    <div className="profile-menu-overlay" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: 'var(--bg-surface-1)', borderRadius: 20, padding: 20, width: 'min(480px, 92vw)', maxHeight: '85vh', overflowY: 'auto', border: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
         <h3 style={{ fontSize: 15, fontWeight: 800, color: 'var(--dark-text)', margin: 0 }}>This Week</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><IconX size={16} /></button>
        </div>
        {loading ? (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 12.5 }}>Loading…</div>
        ) : !report ? (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 12.5 }}>Couldn't load this week's report.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13, color: 'var(--dark-text-2)' }}>
         <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><IconCheckSquare size={13} /> Completed: <strong style={{ color: 'var(--dark-text)' }}>{report.completedCount}</strong></div>
           <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><IconClock size={13} /> Hours studied: <strong style={{ color: 'var(--dark-text)' }}>{report.hoursStudied}</strong></div>
            {report.completionRate !== null && <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><IconChart size={13} /> Completion rate: <strong style={{ color: 'var(--dark-text)' }}>{report.completionRate}%</strong></div>}
            {report.mostProductiveDay && <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><IconStar size={13} filled /> Most productive day: <strong style={{ color: 'var(--dark-text)' }}>{report.mostProductiveDay}</strong></div>}
            {report.missedDeadlines > 0 && <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#f87171' }}><IconAlertTriangle size={13} /> Missed deadlines: {report.missedDeadlines}</div>}
              <div style={{ background: 'rgba(167,139,250,0.08)', border: '1px solid rgba(167,139,250,0.2)', borderRadius: 10, padding: 12 }}>
               {report.suggestions.map((s, i) => <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 6, marginBottom: 4 }}><IconLightbulb size={13} style={{ marginTop: 1, flexShrink: 0 }} /> <span>{s}</span></div>)}
            )}
          </div>
        )}
      </div>
    </div>
  )
}
