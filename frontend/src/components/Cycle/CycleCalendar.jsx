import React, { useState, useMemo, useEffect, useRef } from 'react'
import { IconX, IconChevronLeft, IconChevronRight } from '../Icons'
import { listDailyLogs } from '../../lib/cycle'
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, isSameMonth, isToday, addMonths, subMonths } from 'date-fns'

const SWIPE_THRESHOLD = 50 // px

export default function CycleCalendar({ userId, settings, periodRecords, cycleInfo, onOpenDay, onClose }) {
  const [cursor, setCursor] = useState(new Date())
  const [logsByDate, setLogsByDate] = useState({}) // 'yyyy-MM-dd' -> log row
  const touchStartX = useRef(null)

  useEffect(() => {
    const from = format(startOfMonth(cursor), 'yyyy-MM-dd')
    const to = format(endOfMonth(cursor), 'yyyy-MM-dd')
    listDailyLogs(userId, { fromDate: from, toDate: to })
      .then(logs => {
        const map = {}
        logs.forEach(l => { map[l.log_date] = l })
        setLogsByDate(map)
      })
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

  // Estimated period days for the *next* period
  const estimatedDates = useMemo(() => {
    const set = new Set()
    if (!cycleInfo) return set
    const start = cycleInfo.nextPeriodDate
    for (let i = 0; i < (settings.average_period_length || 5); i++) {
      set.add(format(addDays(start, i), 'yyyy-MM-dd'))
    }
    return set
  }, [cycleInfo, settings])

  // Estimated fertile window — ovulation is typically ~14 days before
  // the next period; window spans 2 days before to 1 day after that.
  // Purely an estimate, shown with its own visual treatment, never
  // implied to be guaranteed (matches the dashboard's phase copy).
  const fertileDates = useMemo(() => {
    const set = new Set()
    if (!cycleInfo?.nextPeriodDate) return set
    const ovulationEstimate = addDays(cycleInfo.nextPeriodDate, -14)
    for (let i = -2; i <= 1; i++) {
      set.add(format(addDays(ovulationEstimate, i), 'yyyy-MM-dd'))
    }
    return set
  }, [cycleInfo])

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(cursor))
    const end = endOfWeek(endOfMonth(cursor))
    const arr = []
    let d = start
    while (d <= end) { arr.push(d); d = addDays(d, 1) }
    return arr
  }, [cursor])

  const goPrev = () => setCursor(c => subMonths(c, 1))
  const goNext = () => setCursor(c => addMonths(c, 1))

  const onTouchStart = (e) => { touchStartX.current = e.touches[0].clientX }
  const onTouchEnd = (e) => {
    if (touchStartX.current === null) return
    const dx = e.changedTouches[0].clientX - touchStartX.current
    if (dx > SWIPE_THRESHOLD) goPrev()
    else if (dx < -SWIPE_THRESHOLD) goNext()
    touchStartX.current = null
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 700, background: 'linear-gradient(160deg, #1b1730 0%, #14121f 55%)', overflowY: 'auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 18px' }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 800, color: '#fff', margin: 0 }}>Calendar</h2>
        <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.08)', border: 'none', borderRadius: '50%', width: 32, height: 32, color: '#fff', cursor: 'pointer' }}><IconX size={15} /></button>
      </div>

      <div
        style={{ maxWidth: 480, margin: '0 auto', padding: '0 18px 90px' }}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <button onClick={goPrev} style={navBtnStyle}><IconChevronLeft size={16} /></button>
          <div
            key={format(cursor, 'yyyy-MM')}
            style={{ fontSize: 15, fontWeight: 700, color: '#fff', animation: 'monthFade 0.2s ease' }}
          >
            {format(cursor, 'MMMM yyyy')}
          </div>
          <button onClick={goNext} style={navBtnStyle}><IconChevronRight size={16} /></button>
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
            const isFertile = !isRecorded && !isEstimated && fertileDates.has(key)
            const log = logsByDate[key]
            const hasFlowLog = log && log.flow && log.flow !== 'none'
            const hasOtherLog = log && !hasFlowLog
            const today = isToday(d)

            let bg = 'transparent'
            let border = '1px solid transparent'
            if (isRecorded) bg = 'linear-gradient(135deg,#6c63ff,#a78bfa)'
            else if (isEstimated) border = '1.5px dashed rgba(167,139,250,0.5)'
            else if (isFertile) border = '1.5px dotted rgba(74,222,128,0.45)'
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
                {!isRecorded && (hasFlowLog || hasOtherLog) && (
                  <span style={{
                    position: 'absolute', bottom: 4, width: 4, height: 4, borderRadius: '50%',
                    background: hasFlowLog ? '#f472b6' : '#c4b5fd',
                  }} />
                )}
              </button>
            )
          })}
        </div>

        <div style={{ display: 'flex', gap: 14, marginTop: 20, flexWrap: 'wrap' }}>
          <Legend swatch={<div style={{ width: 12, height: 12, borderRadius: 4, background: 'linear-gradient(135deg,#6c63ff,#a78bfa)' }} />} label="Recorded period" />
          <Legend swatch={<div style={{ width: 12, height: 12, borderRadius: 4, border: '1.5px dashed rgba(167,139,250,0.5)' }} />} label="Estimated period" />
          <Legend swatch={<div style={{ width: 12, height: 12, borderRadius: 4, border: '1.5px dotted rgba(74,222,128,0.45)' }} />} label="Estimated fertile window" />
          <Legend swatch={<div style={{ width: 6, height: 6, borderRadius: '50%', background: '#f472b6', margin: 3 }} />} label="Flow logged" />
          <Legend swatch={<div style={{ width: 6, height: 6, borderRadius: '50%', background: '#c4b5fd', margin: 3 }} />} label="Check-in logged" />
        </div>

        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 14, lineHeight: 1.6 }}>
          Fertile window is an estimate based on typical cycle patterns — not a guarantee, and not a form of contraception.
        </div>
      </div>

      <style>{`@keyframes monthFade { from { opacity: 0; transform: translateY(2px);} to {opacity:1; transform:none;} }`}</style>
    </div>
  )
}

function Legend({ swatch, label }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>
      {swatch} {label}
    </div>
  )
}

const navBtnStyle = {
  background: 'rgba(255,255,255,0.08)', border: 'none', borderRadius: '50%',
  width: 32, height: 32, color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
}
