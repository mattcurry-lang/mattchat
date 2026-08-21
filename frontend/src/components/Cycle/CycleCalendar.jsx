import React, { useState, useMemo, useEffect } from 'react'
import { IconX, IconChevronLeft, IconChevronRight } from '../Icons'
import { listDailyLogs } from '../../lib/cycle'
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, isSameMonth, isSameDay, isToday, addMonths, subMonths } from 'date-fns'

export default function CycleCalendar({ userId, settings, periodRecords, cycleInfo, onOpenDay, onClose }) {
  const [cursor, setCursor] = useState(new Date())
  const [logDates, setLogDates] = useState(new Set())

  useEffect(() => {
    const from = format(startOfMonth(cursor), 'yyyy-MM-dd')
    const to = format(endOfMonth(cursor), 'yyyy-MM-dd')
    listDailyLogs(userId, { fromDate: from, toDate: to })
      .then(logs => setLogDates(new Set(logs.map(l => l.log_date))))
      .catch(() => {})
  }, [userId, cursor])

  const recordedDates = useMemo(() => {
    const set = new Set()
    periodRecords.forEach(r => {
      const start = new Date(r.start_date + 'T00:00:00')
      const end = r.end_date ? new Date(r.end_date + 'T00:00:00') : start
      let d = start
      while (d <= end) { set.add(format(d, 'yyyy-MM-dd')); d = addDays(d, 1) }
    })
    return set
  }, [periodRecords])

  // Estimated period days for the *next* period, based on cycleInfo
  const estimatedDates = useMemo(() => {
    const set = new Set()
    if (!cycleInfo) return set
    const start = cycleInfo.nextPeriodDate
    for (let i = 0; i < (settings.average_period_length || 5); i++) {
      set.add(format(addDays(start, i), 'yyyy-MM-dd'))
    }
    return set
  }, [cycleInfo, settings])

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(cursor))
    const end = endOfWeek(endOfMonth(cursor))
    const arr = []
    let d = start
    while (d <= end) { arr.push(d); d = addDays(d, 1) }
    return arr
  }, [cursor])

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 700, background: 'linear-gradient(160deg, #1b1730 0%, #14121f 55%)', overflowY: 'auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 18px' }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 800, color: '#fff', margin: 0 }}>Calendar</h2>
        <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.08)', border: 'none', borderRadius: '50%', width: 32, height: 32, color: '#fff', cursor: 'pointer' }}><IconX size={15} /></button>
      </div>

      <div style={{ maxWidth: 480, margin: '0 auto', padding: '0 18px 90px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <button onClick={() => setCursor(subMonths(cursor, 1))} style={navBtnStyle}><IconChevronLeft size={16} /></button>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>{format(cursor, 'MMMM yyyy')}</div>
          <button onClick={() => setCursor(addMonths(cursor, 1))} style={navBtnStyle}><IconChevronRight size={16} /></button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 4, marginBottom: 6 }}>
          {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
            <div key={i} style={{ textAlign: 'center', fontSize: 10.5, fontWeight: 700, color: 'rgba(255,255,255,0.35)', padding: '4px 0' }}>{d}</div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 4 }}>
          {days.map((d, i) => {
            const key = format(d, 'yyyy-MM-dd')
            const inMonth = isSameMonth(d, cursor)
            const isRecorded = recordedDates.has(key)
            const isEstimated = !isRecorded && estimatedDates.has(key)
            const hasLog = logDates.has(key)
            const today = isToday(d)

            let bg = 'transparent'
            let border = '1px solid transparent'
            if (isRecorded) { bg = 'linear-gradient(135deg,#6c63ff,#a78bfa)' }
            else if (isEstimated) { border = '1.5px dashed rgba(167,139,250,0.5)' }
            if (today) border = '1.5px solid #fff'

            return (
              <button
                key={i}
                onClick={() => onOpenDay(key)}
                style={{
                  aspectRatio: '1', borderRadius: 12, background: bg, border,
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  color: inMonth ? '#fff' : 'rgba(255,255,255,0.25)', cursor: 'pointer', position: 'relative',
                  fontFamily: 'inherit', fontSize: 13, fontWeight: today ? 800 : 500,
                }}
              >
                {format(d, 'd')}
                {hasLog && !isRecorded && (
                  <span style={{ position: 'absolute', bottom: 4, width: 4, height: 4, borderRadius: '50%', background: '#c4b5fd' }} />
                )}
              </button>
            )
          })}
        </div>

        <div style={{ display: 'flex', gap: 16, marginTop: 20, flexWrap: 'wrap' }}>
          <Legend swatch={<div style={{ width: 12, height: 12, borderRadius: 4, background: 'linear-gradient(135deg,#6c63ff,#a78bfa)' }} />} label="Recorded period" />
          <Legend swatch={<div style={{ width: 12, height: 12, borderRadius: 4, border: '1.5px dashed rgba(167,139,250,0.5)' }} />} label="Estimated" />
          <Legend swatch={<div style={{ width: 6, height: 6, borderRadius: '50%', background: '#c4b5fd', margin: 3 }} />} label="Logged day" />
        </div>
      </div>
    </div>
  )
}

function Legend({ swatch, label }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: 'rgba(255,255,255,0.5)' }}>
      {swatch} {label}
    </div>
  )
}

const navBtnStyle = {
  background: 'rgba(255,255,255,0.08)', border: 'none', borderRadius: '50%',
  width: 32, height: 32, color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
}
