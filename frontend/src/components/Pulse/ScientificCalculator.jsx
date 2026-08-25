import React, { useState, useEffect, useCallback, useRef } from 'react'

/* ────────────────────────────────────────────────────────────────────────
   MATH ENGINE
   A small hand-written tokenizer + recursive-descent parser. No eval().
   Supports: + - * / % ^ ! ( ) implicit multiplication, decimals,
   unary minus, sin/cos/tan/asin/acos/atan/log/ln/sqrt/cbrt/abs, π, e.
   DEG mode converts trig input to radians and inverse-trig output to degrees.
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
      if (arg < -1 || arg > 1) throw new Error('sin\u207B\u00B9 needs a value between -1 and 1')
      return toDeg(Math.asin(arg))
    case 'acos':
      if (arg < -1 || arg > 1) throw new Error('cos\u207B\u00B9 needs a value between -1 and 1')
      return toDeg(Math.acos(arg))
    case 'atan': return toDeg(Math.atan(arg))
    case 'log':
      if (arg <= 0) throw new Error('log needs a positive number')
      return Math.log10(arg)
    case 'ln':
      if (arg <= 0) throw new Error('ln needs a positive number')
      return Math.log(arg)
    case 'sqrt':
      if (arg < 0) throw new Error('Can\u2019t take the square root of a negative number')
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
    if (!t || t.type !== 'op' || t.value !== v) throw new Error('Syntax error — check your parentheses')
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
          if (rhs === 0) throw new Error('Can\u2019t divide by zero')
          val = val / rhs
        } else {
          val = val * rhs
        }
      } else if (canStartFactor(t)) {
        // implicit multiplication, e.g. 2(3+4) or 3π
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
      const exp = parsePower() // right-associative
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
        if (val < 0 || !Number.isInteger(val)) throw new Error('Factorial needs a non-negative whole number')
        if (val > 170) throw new Error('That factorial is too large')
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
    if (!t) throw new Error('Expression ended unexpectedly')
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
  if (pos !== tokens.length) throw new Error('Syntax error — check your expression')
  if (!Number.isFinite(result)) throw new Error('That expression doesn\u2019t produce a real number')
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
   HISTORY (localStorage, per-user)
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
  } catch {
    // storage unavailable — fail silently, history just won't persist
  }
}

/* ────────────────────────────────────────────────────────────────────────
   COLORS
   The calculator is a deliberately self-contained dark surface — like the
   camera or calculator app on a phone, it doesn't flip with system light
   mode. That's also what fixes the illegible-text bug from before: every
   color here is chosen against this exact background, instead of
   inheriting a text color meant for whatever the rest of Mattchat is doing.
   ──────────────────────────────────────────────────────────────────────── */

const C = {
  bg: '#0c0c16',
  panel: '#15151f',
  key: '#1b1b28',
  keyPress: '#232333',
  border: 'rgba(255,255,255,0.07)',
  textPrimary: '#f4f3f8',
  textSecondary: '#9a9aab',
  textMuted: '#67677a',
  accent: '#a78bfa',
  accentSoft: 'rgba(167,139,250,0.16)',
  accentBorder: 'rgba(167,139,250,0.35)',
  accentText: '#d6c9ff',
  danger: '#f87171',
}

/* ────────────────────────────────────────────────────────────────────────
   ICON — an original Mattchat calculator mark (display bar + key grid,
   with the "=" key picked out), used here and in the Mattchat Tools card.
   ──────────────────────────────────────────────────────────────────────── */

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

/* ────────────────────────────────────────────────────────────────────────
   BUTTON DATA
   ──────────────────────────────────────────────────────────────────────── */

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
  { label: 'x\u00B2', insert: '^2', noOpenParen: true },
  { label: 'x\u00B3', insert: '^3', noOpenParen: true },
  { label: 'x\u02B8', insert: '^' },
  { label: '10\u02E3', insert: '10^(' },
  { label: 'e\u02E3', insert: 'e^(' },
  { label: 'x!', insert: '!', noOpenParen: true },
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

  // Keyboard support (desktop)
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
    <div style={{ position: 'fixed', inset: 0, zIndex: 700, background: C.bg, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 16px', borderBottom: `1px solid ${C.border}`, flexShrink: 0,
      }}
      >
        <button
          onClick={onClose}
          aria-label="Close calculator"
          style={{
            width: 32, height: 32, borderRadius: '50%', border: `1px solid ${C.border}`,
            background: C.key, color: C.textPrimary, display: 'flex',
            alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0,
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 26, height: 26, borderRadius: 8, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'linear-gradient(135deg,#a78bfa,#6c63ff)',
          }}
          >
            <CalculatorGlyph size={15} />
          </div>
          <h2 style={{ fontSize: 15, fontWeight: 800, color: C.textPrimary, margin: 0 }}>Scientific Calculator</h2>
        </div>
        <button
          onClick={() => setDegMode((d) => !d)}
          style={{ display: 'flex', gap: 2, background: C.key, border: `1px solid ${C.border}`, borderRadius: 20, padding: 3, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}
          aria-label="Toggle degrees or radians"
        >
          {['DEG', 'RAD'].map((m) => (
            <span
              key={m}
              style={{
                fontSize: 10.5, fontWeight: 800, padding: '5px 9px', borderRadius: 16,
                color: (m === 'DEG') === degMode ? '#fff' : C.textSecondary,
                background: (m === 'DEG') === degMode ? 'linear-gradient(135deg,#a78bfa,#6c63ff)' : 'transparent',
                transition: 'all 0.2s ease',
              }}
            >
              {m}
            </span>
          ))}
        </button>
      </div>

      {/* Scrollable body, centered on wide/desktop screens so keys never stretch huge */}
      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
        <div style={{ maxWidth: 420, margin: '0 auto', display: 'flex', flexDirection: 'column' }}>
          {/* Display */}
          <div style={{ padding: '16px 16px 8px' }}>
            {prevCalc && (
              <div style={{ fontSize: 12, color: C.textMuted, textAlign: 'right', marginBottom: 4 }}>
                {formatDisplay(prevCalc.expr)} = {prevCalc.result}
              </div>
            )}
            <div
              ref={displayRef}
              style={{
                fontSize: expr.length > 16 ? 20 : 26, fontWeight: 700, color: C.textPrimary,
                textAlign: 'right', overflowX: 'auto', whiteSpace: 'nowrap', minHeight: 32,
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
              }}
            >
              {expr ? formatDisplay(expr) : <span style={{ color: C.textMuted }}>0</span>}
            </div>
            <div style={{ fontSize: 28, fontWeight: 800, textAlign: 'right', marginTop: 4, minHeight: 36, color: error ? C.danger : C.accent }}>
              {error ? error : (result !== null ? `= ${result}` : '')}
            </div>

            {!explainDisabled && (
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 6 }}>
                <button
                  onClick={() => onExplainWithCurry?.({ expression: formatDisplay(expr), result })}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700,
                    background: C.accentSoft, border: `1px solid ${C.accentBorder}`,
                    color: C.accentText, borderRadius: 20, padding: '6px 12px', cursor: 'pointer', fontFamily: 'inherit',
                  }}
                >
                  ✨ Explain with Curry
                </button>
              </div>
            )}
          </div>

          {/* History */}
          <div style={{ padding: '0 16px' }}>
            <button
              onClick={() => setShowHistory((v) => !v)}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                background: C.panel, border: `1px solid ${C.border}`, borderRadius: 12,
                padding: '9px 14px', cursor: 'pointer', fontFamily: 'inherit', color: C.textPrimary,
              }}
            >
              <span style={{ fontSize: 12, fontWeight: 700 }}>History {history.length > 0 ? `(${history.length})` : ''}</span>
              <span style={{ fontSize: 11, color: C.textMuted, transform: showHistory ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s ease' }}>⌄</span>
            </button>

            {showHistory && (
              <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 200, overflowY: 'auto' }}>
                {history.length === 0 && (
                  <div style={{ fontSize: 12, color: C.textMuted, textAlign: 'center', padding: '10px 0' }}>No calculations yet.</div>
                )}
                {history.length > 0 && (
                  <button
                    onClick={clearAllHistory}
                    style={{ alignSelf: 'flex-end', fontSize: 11, color: C.danger, background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700 }}
                  >
                    Clear all
                  </button>
                )}
                {history.map((h) => (
                  <div
                    key={h.id}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
                      background: C.panel, border: `1px solid ${C.border}`, borderRadius: 10, padding: '7px 10px',
                    }}
                  >
                    <button
                      onClick={() => reuseHistory(h)}
                      style={{ flex: 1, textAlign: 'left', background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'inherit', color: C.textPrimary }}
                    >
                      <div style={{ fontSize: 11.5, color: C.textMuted }}>{formatDisplay(h.expr)}</div>
                      <div style={{ fontSize: 13, fontWeight: 700 }}>= {h.result}</div>
                    </button>
                    <button
                      onClick={() => deleteHistoryItem(h.id)}
                      aria-label="Delete calculation"
                      style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: C.textMuted, fontSize: 13, padding: 4 }}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Scientific panel toggle */}
          <div style={{ padding: '12px 16px 0' }}>
            <button
              onClick={() => setShowSci((v) => !v)}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                color: C.textSecondary, fontSize: 11, fontWeight: 700, padding: '4px 0',
              }}
            >
              {showSci ? 'Hide' : 'Show'} scientific functions {showSci ? '▲' : '▼'}
            </button>
          </div>

          {showSci && (
            <div style={{ padding: '4px 16px 4px', display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6 }}>
              {SCI_BUTTONS.map((btn) => (
                <CalcButton key={btn.label} onClick={() => handleButton(btn)} variant="sci">
                  {btn.label}
                </CalcButton>
              ))}
            </div>
          )}

          {/* Keypad */}
          <div style={{ padding: '8px 16px 20px', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
            <CalcButton onClick={handleClear} variant="util">AC</CalcButton>
            <CalcButton onClick={() => insert('(')} variant="util">(</CalcButton>
            <CalcButton onClick={() => insert(')')} variant="util">)</CalcButton>
            <CalcButton onClick={() => insert('%')} variant="util">%</CalcButton>

            <CalcButton onClick={() => insert('7')}>7</CalcButton>
            <CalcButton onClick={() => insert('8')}>8</CalcButton>
            <CalcButton onClick={() => insert('9')}>9</CalcButton>
            <CalcButton onClick={() => insert('/')} variant="op">÷</CalcButton>

            <CalcButton onClick={() => insert('4')}>4</CalcButton>
            <CalcButton onClick={() => insert('5')}>5</CalcButton>
            <CalcButton onClick={() => insert('6')}>6</CalcButton>
            <CalcButton onClick={() => insert('*')} variant="op">×</CalcButton>

            <CalcButton onClick={() => insert('1')}>1</CalcButton>
            <CalcButton onClick={() => insert('2')}>2</CalcButton>
            <CalcButton onClick={() => insert('3')}>3</CalcButton>
            <CalcButton onClick={() => insert('-')} variant="op">−</CalcButton>

            <CalcButton onClick={handleToggleSign}>±</CalcButton>
            <CalcButton onClick={() => insert('0')}>0</CalcButton>
            <CalcButton onClick={() => insert('.')}>.</CalcButton>
            <CalcButton onClick={() => insert('+')} variant="op">+</CalcButton>

            <CalcButton onClick={handleDelete} variant="util">⌫</CalcButton>
            <div style={{ gridColumn: 'span 3' }}>
              <CalcButton onClick={handleEquals} variant="equals" full>=</CalcButton>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function CalcButton({ children, onClick, variant = 'num' }) {
  const [pressed, setPressed] = useState(false)

  const styles = {
    num: { background: C.key, border: `1px solid ${C.border}`, color: C.textPrimary },
    op: { background: C.accentSoft, border: `1px solid ${C.accentBorder}`, color: C.accentText },
    util: { background: C.panel, border: `1px solid ${C.border}`, color: C.textSecondary },
    sci: { background: C.panel, border: `1px solid ${C.border}`, color: C.textSecondary, fontSize: 11.5 },
    equals: { background: 'linear-gradient(135deg,#a78bfa,#6c63ff)', border: 'none', color: '#fff' },
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
        width: '100%',
        height: variant === 'sci' ? 34 : 46,
        borderRadius: 12,
        fontSize: variant === 'sci' ? 11.5 : 16,
        fontWeight: 700,
        cursor: 'pointer',
        fontFamily: 'inherit',
        transform: pressed ? 'scale(0.94)' : 'scale(1)',
        transition: 'transform 0.08s ease, filter 0.15s ease, background 0.15s ease',
        filter: pressed ? 'brightness(1.25)' : 'none',
        background: pressed && variant === 'num' ? C.keyPress : styles[variant].background,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {children}
    </button>
  )
}
