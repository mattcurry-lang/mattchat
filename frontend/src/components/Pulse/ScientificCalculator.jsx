import React, { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'

/* ────────────────────────────────────────────────────────────────────────
   MATH ENGINE
   ──────────────────────────────────────────────────────────────────────── */

const FUNC_NAMES = new Set(['sin', 'cos', 'tan', 'asin', 'acos', 'atan', 'log', 'ln', 'sqrt', 'cbrt', 'abs'])

function tokenize(expr) {
  const tokens = []
  let i = 0
  while (i < expr.length) {
    const ch = expr[i]
    if (/\s/.test(ch)) { i++; continue }
    if (/[0-9.]/.test(ch)) {
      const start = i
      while (i < expr.length && /[0-9.]/.test(expr[i])) i++
      const raw = expr.slice(start, i)
      if ((raw.match(/\./g) || []).length > 1) throw new Error('Invalid number')
      tokens.push({ type: 'num', value: parseFloat(raw) })
      continue
    }
    if (/[a-zA-Zπ]/.test(ch)) {
      const start = i
      while (i < expr.length && /[a-zA-Zπ]/.test(expr[i])) i++
      tokens.push({ type: 'id', value: expr.slice(start, i) })
      continue
    }
    if ('+-*/^%!().'.includes(ch)) {
      tokens.push({ type: 'op', value: ch })
      i++
      continue
    }
    throw new Error(`Unexpected character "${ch}"`)
  }
  return tokens
}

function applyFunction(name, arg, degMode) {
  const toRad = (v) => (degMode ? (v * Math.PI) / 180 : v)
  const toDeg = (v) => (degMode ? (v * 180) / Math.PI : v)
  switch (name) {
    case 'sin': return Math.sin(toRad(arg))
    case 'cos': return Math.cos(toRad(arg))
    case 'tan': return Math.tan(toRad(arg))
    case 'asin':
      if (arg < -1 || arg > 1) throw new Error('sin\u207B\u00B9 needs value between -1 and 1')
      return toDeg(Math.asin(arg))
    case 'acos':
      if (arg < -1 || arg > 1) throw new Error('cos\u207B\u00B9 needs value between -1 and 1')
      return toDeg(Math.acos(arg))
    case 'atan': return toDeg(Math.atan(arg))
    case 'log':
      if (arg <= 0) throw new Error('log needs positive number')
      return Math.log10(arg)
    case 'ln':
      if (arg <= 0) throw new Error('ln needs positive number')
      return Math.log(arg)
    case 'sqrt':
      if (arg < 0) throw new Error('Can\u2019t square root negative')
      return Math.sqrt(arg)
    case 'cbrt': return Math.cbrt(arg)
    case 'abs': return Math.abs(arg)
    default: throw new Error(`Unknown function "${name}"`)
  }
}

function evaluateExpression(expr, degMode) {
  if (!expr || !expr.trim()) throw new Error('Nothing to calculate')
  const tokens = tokenize(expr)
  let pos = 0
  const peek = () => tokens[pos]
  const next = () => tokens[pos++]
  const expectOp = (v) => {
    const t = next()
    if (!t || t.type !== 'op' || t.value !== v) throw new Error('Syntax error')
  }
  const canStartFactor = (t) => {
    if (!t) return false
    if (t.type === 'num' || t.type === 'id') return true
    if (t.type === 'op' && t.value === '(') return true
    return false
  }

  function parseExpr() {
    let val = parseTerm()
    while (peek() && peek().type === 'op' && (peek().value === '+' || peek().value === '-')) {
      const op = next().value
      const rhs = parseTerm()
      val = op === '+' ? val + rhs : val - rhs
    }
    return val
  }

  function parseTerm() {
    let val = parsePower()
    while (true) {
      const t = peek()
      if (t && t.type === 'op' && (t.value === '*' || t.value === '/')) {
        const op = next().value
        const rhs = parsePower()
        if (op === '/') {
          if (rhs === 0) throw new Error('Division by zero')
          val = val / rhs
        } else {
          val = val * rhs
        }
      } else if (canStartFactor(t)) {
        const rhs = parsePower()
        val = val * rhs
      } else break
    }
    return val
  }

  function parsePower() {
    const base = parseUnary()
    if (peek() && peek().type === 'op' && peek().value === '^') {
      next()
      const exp = parsePower()
      return Math.pow(base, exp)
    }
    return base
  }

  function parseUnary() {
    if (peek() && peek().type === 'op' && peek().value === '-') {
      next()
      return -parseUnary()
    }
    return parsePostfix()
  }

  function parsePostfix() {
    let val = parsePrimary()
    while (peek() && peek().type === 'op' && (peek().value === '!' || peek().value === '%')) {
      const op = next().value
      if (op === '!') {
        if (val < 0 || !Number.isInteger(val)) throw new Error('Factorial needs whole number')
        if (val > 170) throw new Error('Number too large')
        let f = 1
        for (let k = 2; k <= val; k++) f *= k
        val = f
      } else {
        val = val / 100
      }
    }
    return val
  }

  function parsePrimary() {
    const t = peek()
    if (!t) throw new Error('Unexpected end')
    if (t.type === 'num') { next(); return t.value }
    if (t.type === 'op' && t.value === '(') {
      next()
      const val = parseExpr()
      expectOp(')')
      return val
    }
    if (t.type === 'id') {
      const name = t.value
      if (name === 'π') { next(); return Math.PI }
      if (name === 'e') { next(); return Math.E }
      if (!FUNC_NAMES.has(name)) throw new Error(`Unknown function "${name}"`)
      next()
      expectOp('(')
      const arg = parseExpr()
      expectOp(')')
      return applyFunction(name, arg, degMode)
    }
    throw new Error('Syntax error')
  }

  const result = parseExpr()
  if (pos !== tokens.length) throw new Error('Syntax error')
  if (!Number.isFinite(result)) throw new Error('Not a real number')
  return result
}

function formatDisplay(expr) {
  return expr
    .replace(/asin\(/g, 'sin\u207B\u00B9(')
    .replace(/acos\(/g, 'cos\u207B\u00B9(')
    .replace(/atan\(/g, 'tan\u207B\u00B9(')
    .replace(/sqrt\(/g, '\u221A(')
    .replace(/cbrt\(/g, '\u221B(')
    .replace(/\*/g, '\u00D7')
    .replace(/\//g, '\u00F7')
}

function formatResult(n) {
  if (Object.is(n, -0)) n = 0
  if (Math.abs(n) < 1e-12) n = 0
  const rounded = Math.round(n * 1e10) / 1e10
  if (Math.abs(rounded) >= 1e12 || (Math.abs(rounded) < 1e-6 && rounded !== 0)) {
    return rounded.toExponential(6).replace('e', ' \u00D7 10^')
  }
  return rounded.toLocaleString('en-US', { maximumFractionDigits: 10 })
}

/* ────────────────────────────────────────────────────────────────────────
   STORAGE & PALETTE
   ──────────────────────────────────────────────────────────────────────── */

const historyKey = (userId) => `mattchat_calc_history_${userId || 'guest'}`

function loadHistory(userId) {
  try {
    const raw = localStorage.getItem(historyKey(userId))
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveHistory(userId, list) {
  try {
    localStorage.setItem(historyKey(userId), JSON.stringify(list.slice(0, 50)))
  } catch {}
}

const C = {
  bg: '#0f0e17',
  displayBg: '#151421',
  keyNum: '#1f1e2e',
  keyUtil: '#28263d',
  keyOp: '#6c63ff',
  keyEquals: 'linear-gradient(135deg, #7c73ff, #5848c2)',
  textPrimary: '#ffffff',
  textSecondary: '#a5a3bc',
  textMuted: '#6e6c88',
  border: 'rgba(255,255,255,0.06)',
  danger: '#ff6b6b',
}

export function CalculatorGlyph({ size = 18, color = '#fff' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="3.5" y="2" width="17" height="20" rx="4.5" stroke={color} strokeWidth="1.6" />
      <rect x="6" y="4.5" width="12" height="4.6" rx="1.4" fill={color} fillOpacity="0.92" />
      <circle cx="7.9" cy="13.2" r="1.15" fill={color} />
      <circle cx="12" cy="13.2" r="1.15" fill={color} />
      <circle cx="7.9" cy="17.1" r="1.15" fill={color} />
      <rect x="14.6" y="12.1" width="3.9" height="6.1" rx="1.95" fill={color} />
    </svg>
  )
}

const SCI_BUTTONS = [
  { label: 'sin', insert: 'sin(' },
  { label: 'cos', insert: 'cos(' },
  { label: 'tan', insert: 'tan(' },
  { label: 'sin\u207B\u00B9', insert: 'asin(' },
  { label: 'cos\u207B\u00B9', insert: 'acos(' },
  { label: 'tan\u207B\u00B9', insert: 'atan(' },
  { label: 'log', insert: 'log(' },
  { label: 'ln', insert: 'ln(' },
  { label: '\u221A', insert: 'sqrt(' },
  { label: '\u221B', insert: 'cbrt(' },
  { label: 'x\u00B2', insert: '^2' },
  { label: 'x\u00B3', insert: '^3' },
  { label: 'x\u02B8', insert: '^' },
  { label: '10\u02E3', insert: '10^(' },
  { label: 'e\u02E3', insert: 'e^(' },
  { label: 'x!', insert: '!' },
  { label: '|x|', insert: 'abs(' },
  { label: '\u03C0', insert: '\u03C0' },
  { label: 'e', insert: 'e' },
  { label: '1/x', special: 'reciprocal' },
]

/* ────────────────────────────────────────────────────────────────────────
   COMPONENT
   ──────────────────────────────────────────────────────────────────────── */

export default function ScientificCalculator({ userId, onClose, onExplainWithCurry }) {
  const [expr, setExpr] = useState('')
  const [result, setResult] = useState(null)
  const [prevCalc, setPrevCalc] = useState(null)
  const [error, setError] = useState(null)
  const [degMode, setDegMode] = useState(true)
  const [showSci, setShowSci] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [history, setHistory] = useState(() => loadHistory(userId))
  const displayRef = useRef(null)

  useEffect(() => {
    if (displayRef.current) displayRef.current.scrollLeft = displayRef.current.scrollWidth
  }, [expr])

  const pushHistory = useCallback((exprStr, resultStr) => {
    setHistory((prev) => {
      const entry = { id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, expr: exprStr, result: resultStr, degMode }
      const updated = [entry, ...prev].slice(0, 50)
      saveHistory(userId, updated)
      return updated
    })
  }, [degMode, userId])

  const insert = (token) => {
    setError(null)
    setExpr((prev) => prev + token)
  }

  const handleReciprocal = () => {
    setError(null)
    setExpr((prev) => {
      const match = prev.match(/(\(-?[0-9.]+\)|-?[0-9.]+)$/)
      if (!match) return prev + '1/('
      const before = prev.slice(0, prev.length - match[0].length)
      return `${before}1/(${match[0]})`
    })
  }

  const handleToggleSign = () => {
    setError(null)
    setExpr((prev) => {
      const wrapped = prev.match(/\(-([0-9.]+)\)$/)
      if (wrapped) return prev.slice(0, prev.length - wrapped[0].length) + wrapped[1]
      const bare = prev.match(/-?[0-9.]+$/)
      if (bare) {
        const before = prev.slice(0, prev.length - bare[0].length)
        const val = bare[0]
        return val.startsWith('-') ? before + val.slice(1) : `${before}(-${val})`
      }
      return prev + '(-'
    })
  }

  const handleClear = () => {
    setExpr('')
    setResult(null)
    setPrevCalc(null)
    setError(null)
  }

  const handleDelete = () => {
    setError(null)
    setExpr((prev) => prev.slice(0, -1))
  }

  const handleEquals = () => {
    try {
      const value = evaluateExpression(expr, degMode)
      const resultStr = formatResult(value)
      setResult(resultStr)
      setError(null)
      setPrevCalc({ expr, result: resultStr })
      pushHistory(expr, resultStr)
    } catch (e) {
      setError(e.message || 'Invalid expression')
      setResult(null)
    }
  }

  const handleButton = (btn) => {
    if (btn.special === 'reciprocal') return handleReciprocal()
    insert(btn.insert)
  }

  const reuseHistory = (entry) => {
    setExpr(entry.expr)
    setResult(entry.result)
    setPrevCalc(entry)
    setError(null)
    setDegMode(entry.degMode ?? true)
    setShowHistory(false)
  }

  const deleteHistoryItem = (id) => {
    setHistory((prev) => {
      const updated = prev.filter((h) => h.id !== id)
      saveHistory(userId, updated)
      return updated
    })
  }

  const clearAllHistory = () => {
    setHistory([])
    saveHistory(userId, [])
  }

  useEffect(() => {
    const onKeyDown = (e) => {
      const key = e.key
      if (/^[0-9.]$/.test(key)) { insert(key); return }
      if (['+', '-', '*', '/', '%', '(', ')', '^'].includes(key)) { insert(key); return }
      if (key === 'Enter' || key === '=') { e.preventDefault(); handleEquals(); return }
      if (key === 'Backspace') { handleDelete(); return }
      if (key === 'Escape') { handleClear(); return }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [expr, degMode])

  const explainDisabled = result === null || !!error

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 700, background: C.bg, display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      {/* Top Navigation */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '16px 20px', borderBottom: `1px solid ${C.border}`, flexShrink: 0,
      }}>
        <button
          onClick={onClose}
          aria-label="Close calculator"
          style={{
            width: 36, height: 36, borderRadius: '50%', border: `1px solid ${C.border}`,
            background: C.keyNum, color: C.textPrimary, display: 'flex',
            alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
          }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #7c73ff, #5848c2)' }}>
            <CalculatorGlyph size={16} />
          </div>
          <span style={{ fontSize: 16, fontWeight: 700, color: C.textPrimary, letterSpacing: '-0.01em' }}>Calculator</span>
        </div>

        <button
          onClick={() => setDegMode((d) => !d)}
          style={{ display: 'flex', background: C.keyNum, border: `1px solid ${C.border}`, borderRadius: 20, padding: 3, cursor: 'pointer' }}
          aria-label="Toggle degrees or radians"
        >
          {['DEG', 'RAD'].map((m) => (
            <span
              key={m}
              style={{
                fontSize: 11, fontWeight: 700, padding: '5px 10px', borderRadius: 16,
                color: (m === 'DEG') === degMode ? '#fff' : C.textSecondary,
                background: (m === 'DEG') === degMode ? '#6c63ff' : 'transparent',
                transition: 'all 0.15s ease',
              }}
            >
              {m}
            </span>
          ))}
        </button>
      </div>

      {/* Calculator Body Container */}
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
        <div style={{ width: '100%', maxWidth: 390, display: 'flex', flexDirection: 'column', gap: 14 }}>
          
          {/* Display screen */}
          <div style={{
            background: C.displayBg, border: `1px solid ${C.border}`, borderRadius: 24,
            padding: '20px 22px', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
            minHeight: 110, boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.3)'
          }}>
            {prevCalc && (
              <div style={{ fontSize: 13, color: C.textMuted, textAlign: 'right', marginBottom: 4 }}>
                {formatDisplay(prevCalc.expr)} = {prevCalc.result}
              </div>
            )}
            <div
              ref={displayRef}
              style={{
                fontSize: expr.length > 18 ? 22 : 28, fontWeight: 600, color: C.textPrimary,
                textAlign: 'right', overflowX: 'auto', whiteSpace: 'nowrap', minHeight: 36,
                fontFamily: 'ui-monospace, SFMono-Regular, monospace', letterSpacing: '-0.5px'
              }}
            >
              {expr ? formatDisplay(expr) : <span style={{ color: C.textMuted }}>0</span>}
            </div>
            <div style={{ fontSize: 32, fontWeight: 700, textAlign: 'right', marginTop: 6, minHeight: 40, color: error ? C.danger : '#a78bfa', letterSpacing: '-0.5px' }}>
              {error ? error : (result !== null ? `= ${result}` : '')}
            </div>
          </div>

          {/* Action Row: Explain with Curry & History toggles */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 4px' }}>
            <button
              onClick={() => setShowHistory((v) => !v)}
              style={{
                background: 'transparent', border: 'none', color: C.textSecondary,
                fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, padding: 0
              }}
            >
              <span>History</span>
              <span style={{ fontSize: 10, transform: showHistory ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>▼</span>
            </button>

            {!explainDisabled && (
              <button
                onClick={() => onExplainWithCurry?.({ expression: formatDisplay(expr), result })}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 700,
                  background: 'rgba(108, 99, 255, 0.15)', border: '1px solid rgba(108, 99, 255, 0.35)',
                  color: '#d0cbfd', borderRadius: 20, padding: '6px 14px', cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                ✨ Explain with Curry
              </button>
            )}
          </div>

          {/* History Drawer Dropdown */}
          {showHistory && (
            <div style={{
              background: C.displayBg, border: `1px solid ${C.border}`, borderRadius: 18,
              padding: '12px', maxHeight: 180, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6
            }}>
              {history.length === 0 && (
                <div style={{ fontSize: 12.5, color: C.textMuted, textAlign: 'center', padding: '12px 0' }}>No calculation history.</div>
              )}
              {history.length > 0 && (
                <div style={{ display: 'flex', justifyContent: 'flex-end', paddingBottom: 4 }}>
                  <button onClick={clearAllHistory} style={{ fontSize: 11, color: C.danger, background: 'transparent', border: 'none', cursor: 'pointer', fontWeight: 700 }}>Clear all</button>
                </div>
              )}
              {history.map((h) => (
                <div key={h.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: C.keyNum, borderRadius: 12, padding: '8px 12px' }}>
                  <button onClick={() => reuseHistory(h)} style={{ flex: 1, textAlign: 'left', background: 'transparent', border: 'none', cursor: 'pointer', color: C.textPrimary }}>
                    <div style={{ fontSize: 11.5, color: C.textMuted }}>{formatDisplay(h.expr)}</div>
                    <div style={{ fontSize: 13.5, fontWeight: 700 }}>= {h.result}</div>
                  </button>
                  <button onClick={() => deleteHistoryItem(h.id)} style={{ background: 'transparent', border: 'none', color: C.textMuted, cursor: 'pointer', fontSize: 13, padding: 4 }}>✕</button>
                </div>
              ))}
            </div>
          )}

          {/* Scientific Mode Toggle */}
          <button
            onClick={() => setShowSci((v) => !v)}
            style={{
              width: '100%', background: C.keyNum, border: `1px solid ${C.border}`, borderRadius: 14,
              padding: '8px', color: C.textSecondary, fontSize: 12, fontWeight: 700, cursor: 'pointer'
            }}
          >
            {showSci ? 'Standard Keypad' : 'Scientific Keypad'}
          </button>

          {/* Scientific Grid */}
          {showSci && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
              {SCI_BUTTONS.map((btn) => (
                <CalcButton key={btn.label} onClick={() => handleButton(btn)} variant="sci">
                  {btn.label}
                </CalcButton>
              ))}
            </div>
          )}

          {/* Standard Keypad Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
            <CalcButton onClick={handleClear} variant="util">AC</CalcButton>
            <CalcButton onClick={() => insert('(')} variant="util">(</CalcButton>
            <CalcButton onClick={() => insert(')')} variant="util">)</CalcButton>
            <CalcButton onClick={() => insert('/')} variant="op">÷</CalcButton>

            <CalcButton onClick={() => insert('7')}>7</CalcButton>
            <CalcButton onClick={() => insert('8')}>8</CalcButton>
            <CalcButton onClick={() => insert('9')}>9</CalcButton>
            <CalcButton onClick={() => insert('*')} variant="op">×</CalcButton>

            <CalcButton onClick={() => insert('4')}>4</CalcButton>
            <CalcButton onClick={() => insert('5')}>5</CalcButton>
            <CalcButton onClick={() => insert('6')}>6</CalcButton>
            <CalcButton onClick={() => insert('-')} variant="op">−</CalcButton>

            <CalcButton onClick={() => insert('1')}>1</CalcButton>
            <CalcButton onClick={() => insert('2')}>2</CalcButton>
            <CalcButton onClick={() => insert('3')}>3</CalcButton>
            <CalcButton onClick={() => insert('+')} variant="op">+</CalcButton>

            <CalcButton onClick={handleToggleSign} variant="util">±</CalcButton>
            <CalcButton onClick={() => insert('0')}>0</CalcButton>
            <CalcButton onClick={() => insert('.')}>.</CalcButton>
            <CalcButton onClick={handleEquals} variant="equals">=</CalcButton>
          </div>

          {/* Extra row for Backspace & Percentage */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <CalcButton onClick={() => insert('%')} variant="util">%</CalcButton>
            <CalcButton onClick={handleDelete} variant="util">⌫ Delete</CalcButton>
          </div>

        </div>
      </div>
    </div>
  )
}

function CalcButton({ children, onClick, variant = 'num' }) {
  const [pressed, setPressed] = useState(false)

  const styles = {
    num: { background: C.keyNum, color: C.textPrimary },
    op: { background: '#2d2b48', color: '#a78bfa' },
    util: { background: C.keyUtil, color: C.textSecondary },
    sci: { background: C.keyUtil, color: C.textSecondary, fontSize: 12 },
    equals: { background: C.keyEquals, color: '#ffffff' },
  }

  return (
    <button
      onClick={onClick}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onMouseLeave={() => setPressed(false)}
      onTouchStart={() => setPressed(true)}
      onTouchEnd={() => setPressed(false)}
      style={{
        ...styles[variant],
        height: variant === 'sci' ? 40 : 54,
        borderRadius: 16,
        border: `1px solid ${C.border}`,
        fontSize: variant === 'sci' ? 12 : 18,
        fontWeight: 600,
        cursor: 'pointer',
        fontFamily: 'inherit',
        transform: pressed ? 'scale(0.95)' : 'scale(1)',
        transition: 'transform 0.08s ease, filter 0.15s ease',
        filter: pressed ? 'brightness(1.3)' : 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: variant === 'equals' ? '0 4px 14px rgba(108, 99, 255, 0.4)' : 'none'
      }}
    >
      {children}
    </button>
  )
}
