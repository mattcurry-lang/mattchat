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
      if (arg < -1 || arg > 1) throw new Error('sin⁻¹ needs a value between -1 and 1')
      return toDeg(Math.asin(arg))
    case 'acos':
      if (arg < -1 || arg > 1) throw new Error('cos⁻¹ needs a value between -1 and 1')
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
  const [showSci, setShowSci] = useState(true)
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expr, degMode])

  const explainDisabled = result === null || !!error

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 700, background: 'var(--bg-surface-1, #0f0f1a)',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 16px', borderBottom: '1px solid var(--border)', flexShrink: 0,
      }}
      >
        <button
          onClick={onClose}
          aria-label="Close calculator"
          style={{
            width: 34, height: 34, borderRadius: '50%', border: '1px solid var(--border)',
            background: 'var(--bg-surface-2)', color: 'var(--text-primary)', display: 'flex',
            alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
        </button>
        <h2 style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>🧮 Scientific Calculator</h2>
        <button
          onClick={() => setDegMode((d) => !d)}
          style={{
            display: 'flex', gap: 2, background: 'var(--bg-surface-2)', border: '1px solid var(--border)',
            borderRadius: 20, padding: 3, cursor: 'pointer', fontFamily: 'inherit',
          }}
          aria-label="Toggle degrees or radians"
        >
          {['DEG', 'RAD'].map((m) => (
            <span
              key={m}
              style={{
                fontSize: 11, fontWeight: 800, padding: '5px 10px', borderRadius: 16,
                color: (m === 'DEG') === degMode ? '#fff' : 'var(--text-secondary)',
                background: (m === 'DEG') === degMode ? 'linear-gradient(135deg,#a78bfa,#6c63ff)' : 'transparent',
                transition: 'all 0.2s ease',
              }}
            >
              {m}
            </span>
          ))}
        </button>
      </div>

      {/* Scrollable body */}
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        {/* Display */}
        <div style={{ padding: '18px 16px 10px', flexShrink: 0 }}>
          {prevCalc && (
            <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'right', marginBottom: 4, opacity: 0.8 }}>
              {formatDisplay(prevCalc.expr)} = {prevCalc.result}
            </div>
          )}
          <div
            ref={displayRef}
            style={{
              fontSize: expr.length > 18 ? 22 : 30, fontWeight: 700, color: 'var(--text-primary)',
              textAlign: 'right', overflowX: 'auto', whiteSpace: 'nowrap', minHeight: 38,
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
            }}
          >
            {expr ? formatDisplay(expr) : <span style={{ color: 'var(--text-muted)' }}>0</span>}
          </div>
          <div style={{ fontSize: 34, fontWeight: 800, textAlign: 'right', marginTop: 6, minHeight: 42, color: error ? '#f87171' : '#a78bfa' }}>
            {error ? error : (result !== null ? `= ${result}` : '')}
          </div>

          {!explainDisabled && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 6 }}>
              <button
                onClick={() => onExplainWithCurry?.({ expression: formatDisplay(expr), result })}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700,
                  background: 'rgba(167,139,250,0.14)', border: '1px solid rgba(167,139,250,0.3)',
                  color: '#c4b5fd', borderRadius: 20, padding: '6px 12px', cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                ✨ Explain with Curry
              </button>
            </div>
          )}
        </div>

        {/* History */}
        <div style={{ padding: '0 16px', flexShrink: 0 }}>
          <button
            onClick={() => setShowHistory((v) => !v)}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              background: 'var(--bg-surface-2)', border: '1px solid var(--border)', borderRadius: 12,
              padding: '10px 14px', cursor: 'pointer', fontFamily: 'inherit', color: 'var(--text-primary)',
            }}
          >
            <span style={{ fontSize: 12.5, fontWeight: 700 }}>History {history.length > 0 ? `(${history.length})` : ''}</span>
            <span style={{ fontSize: 12, color: 'var(--text-muted)', transform: showHistory ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s ease' }}>⌄</span>
          </button>

          {showHistory && (
            <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 220, overflowY: 'auto' }}>
              {history.length === 0 && (
                <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', padding: '10px 0' }}>No calculations yet.</div>
              )}
              {history.length > 0 && (
                <button
                  onClick={clearAllHistory}
                  style={{
                    alignSelf: 'flex-end', fontSize: 11, color: '#f87171', background: 'transparent',
                    border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700,
                  }}
                >
                  Clear all
                </button>
              )}
              {history.map((h) => (
                <div
                  key={h.id}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
                    background: 'var(--bg-surface-2)', border: '1px solid var(--border)', borderRadius: 10,
                    padding: '8px 10px',
                  }}
                >
                  <button
                    onClick={() => reuseHistory(h)}
                    style={{
                      flex: 1, textAlign: 'left', background: 'transparent', border: 'none', cursor: 'pointer',
                      fontFamily: 'inherit', color: 'var(--text-primary)',
                    }}
                  >
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{formatDisplay(h.expr)}</div>
                    <div style={{ fontSize: 13.5, fontWeight: 700 }}>= {h.result}</div>
                  </button>
                  <button
                    onClick={() => deleteHistoryItem(h.id)}
                    aria-label="Delete calculation"
                    style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 14, padding: 4 }}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Scientific panel toggle */}
        <div style={{ padding: '14px 16px 0', flexShrink: 0 }}>
          <button
            onClick={() => setShowSci((v) => !v)}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
              color: 'var(--text-secondary)', fontSize: 11.5, fontWeight: 700, padding: '4px 0',
            }}
          >
            {showSci ? 'Hide' : 'Show'} scientific functions {showSci ? '▲' : '▼'}
          </button>
        </div>

        {showSci && (
          <div style={{ padding: '0 16px 10px', display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8, flexShrink: 0 }}>
            {SCI_BUTTONS.map((btn) => (
              <CalcButton key={btn.label} onClick={() => handleButton(btn)} variant="sci">
                {btn.label}
              </CalcButton>
            ))}
          </div>
        )}

        {/* Keypad */}
        <div style={{ padding: '10px 16px 24px', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, flexShrink: 0 }}>
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
  )
}

function CalcButton({ children, onClick, variant = 'num', full = false }) {
  const [pressed, setPressed] = useState(false)

  const styles = {
    num: { background: 'var(--bg-surface-2)', border: '1px solid var(--border)', color: 'var(--text-primary)' },
    op: { background: 'rgba(167,139,250,0.14)', border: '1px solid rgba(167,139,250,0.3)', color: '#c4b5fd' },
    util: { background: 'var(--bg-surface-2)', border: '1px solid var(--border)', color: 'var(--text-secondary)' },
    sci: { background: 'var(--bg-surface-2)', border: '1px solid var(--border)', color: 'var(--text-secondary)', fontSize: 12.5 },
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
        height: variant === 'sci' ? 40 : 52,
        borderRadius: 14,
        fontSize: variant === 'sci' ? 12.5 : 18,
        fontWeight: 700,
        cursor: 'pointer',
        fontFamily: 'inherit',
        transform: pressed ? 'scale(0.94)' : 'scale(1)',
        transition: 'transform 0.08s ease, filter 0.15s ease',
        filter: pressed ? 'brightness(1.12)' : 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {children}
    </button>
  )
}
