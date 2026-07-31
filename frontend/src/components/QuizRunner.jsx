import { useState } from 'react'
import { IconX, IconCheckSquare } from './Icons'

export default function QuizRunner({ questions, title, onClose }) {
  const [index, setIndex] = useState(0)
  const [selected, setSelected] = useState(null)
  const [answers, setAnswers] = useState([])
  const [finished, setFinished] = useState(false)

  if (!questions || questions.length === 0) return null
  const q = questions[index]
  const isLast = index === questions.length - 1

  const choose = (i) => { if (selected === null) setSelected(i) }

  const next = () => {
    const isCorrect = selected === q.correctIndex
    const nextAnswers = [...answers, isCorrect]
    setAnswers(nextAnswers)
    setSelected(null)
    if (isLast) setFinished(true)
    else setIndex((i) => i + 1)
  }

  if (finished) {
    const score = answers.filter(Boolean).length
    return (
      <div style={s.overlay} onClick={onClose}>
        <div style={s.modal} onClick={(e) => e.stopPropagation()}>
          <div style={s.header}>
            <div style={s.headerTitle}>{title || 'Quiz'} results</div>
            <button style={s.iconBtn} onClick={onClose}><IconX size={16} /></button>
          </div>
          <div style={s.resultWrap}>
            <IconCheckSquare size={32} style={{ color: '#a78bfa' }} />
            <div style={s.resultScore}>{score} / {questions.length}</div>
            <div style={s.resultLabel}>
              {score === questions.length ? 'Perfect score!' : score >= questions.length * 0.6 ? 'Solid work.' : 'Worth another pass over the material.'}
            </div>
          </div>
          <button style={s.closeBtn} onClick={onClose}>Done</button>
        </div>
      </div>
    )
  }

  return (
    <div style={s.overlay} onClick={onClose}>
      <div style={s.modal} onClick={(e) => e.stopPropagation()}>
        <div style={s.header}>
          <div style={s.headerTitle}>{title || 'Quiz'} · {index + 1}/{questions.length}</div>
          <button style={s.iconBtn} onClick={onClose}><IconX size={16} /></button>
        </div>

        <div style={s.question}>{q.question}</div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {q.options.map((opt, i) => {
            const isCorrectOpt = i === q.correctIndex
            const isChosen = i === selected
            let bg = 'rgba(255,255,255,0.04)', border = 'var(--border)', color = 'var(--text-primary)'
            if (selected !== null) {
              if (isCorrectOpt) { bg = 'rgba(74,222,128,0.12)'; border = 'rgba(74,222,128,0.4)'; color = '#4ade80' }
              else if (isChosen) { bg = 'rgba(248,113,113,0.12)'; border = 'rgba(248,113,113,0.4)'; color = '#f87171' }
            }
            return (
              <button
                key={i}
                onClick={() => choose(i)}
                disabled={selected !== null}
                style={{ ...s.option, background: bg, borderColor: border, color, cursor: selected === null ? 'pointer' : 'default' }}
              >
                {opt}
              </button>
            )
          })}
        </div>

        {selected !== null && (
          <button style={s.nextBtn} onClick={next}>{isLast ? 'See results' : 'Next question'} →</button>
        )}
      </div>
    </div>
  )
}

const s = {
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 },
  modal: { background: 'var(--bg-surface-1, #14141f)', borderRadius: 20, padding: 20, width: 'min(440px, 100%)', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 16 },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  headerTitle: { fontSize: 13.5, fontWeight: 700, color: 'var(--text-primary)' },
  iconBtn: { background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex' },
  question: { fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.5 },
  option: {
    textAlign: 'left', border: '1px solid', borderRadius: 12, padding: '11px 14px',
    fontSize: 13.5, fontWeight: 600, fontFamily: 'inherit', transition: 'all 0.15s',
  },
  nextBtn: {
    background: 'linear-gradient(135deg,#667eea,#764ba2)', border: 'none', borderRadius: 12,
    color: '#fff', fontSize: 13.5, fontWeight: 700, padding: '11px 14px', cursor: 'pointer', fontFamily: 'inherit',
  },
  resultWrap: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '16px 0' },
  resultScore: { fontSize: 30, fontWeight: 800, color: 'var(--text-primary)' },
  resultLabel: { fontSize: 13, color: 'var(--text-muted)' },
  closeBtn: {
    background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', borderRadius: 12,
    color: 'var(--text-primary)', fontSize: 13.5, fontWeight: 700, padding: '10px 14px', cursor: 'pointer', fontFamily: 'inherit',
  },
}
