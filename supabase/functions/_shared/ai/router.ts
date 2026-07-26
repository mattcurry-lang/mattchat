import { geminiProvider } from './providers/gemini.ts'
import { groqProvider } from './providers/groq.ts'
import { openrouterProvider } from './providers/openrouter.ts'
import { cerebrasProvider } from './providers/cerebras.ts'
import { AIProvider, GenerateOptions, GenerateResult, ProviderError, TaskType } from './types.ts'

const REGISTRY: Record<string, AIProvider> = {
  gemini: geminiProvider,
  groq: groqProvider,
  openrouter: openrouterProvider,
  cerebras: cerebrasProvider,
}

// Order of preference per task. Vision/document tasks only list Gemini
// today since it's the only provider wired for inline images — adding
// a vision-capable Groq/OpenRouter model later just means adding it
// here and setting supportsVision: true on that provider.
const ROUTING: Record<TaskType, string[]> = {
  chat: ['groq', 'gemini', 'openrouter', 'cerebras'],
  coding: ['groq', 'gemini', 'openrouter', 'cerebras'],
  quick: ['groq', 'gemini', 'openrouter', 'cerebras'],
  general_reasoning: ['groq', 'gemini', 'openrouter', 'cerebras'],
  email_summary: ['gemini', 'groq', 'openrouter', 'cerebras'],
  document_analysis: ['gemini'],
  image_understanding: ['gemini'],
  vision: ['gemini'],
  unknown: ['groq', 'gemini', 'openrouter', 'cerebras'],
}

const RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504])

function isRetryable(err: unknown): boolean {
  if (err instanceof ProviderError) {
    if (err.status && RETRYABLE_STATUSES.has(err.status)) return true
    if (!err.status) return true // network error / timeout — no status means transport-level failure
    return false
  }
  return true // unknown error shape — err on the side of trying the next provider
}

function withTimeout<T>(promise: Promise<T>, ms: number, providerName: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new ProviderError(`${providerName} timed out after ${ms}ms`)), ms)
    promise.then((v) => { clearTimeout(timer); resolve(v) }, (e) => { clearTimeout(timer); reject(e) })
  })
}

function pickProviders(taskType: TaskType, needsVision: boolean, needsSearch: boolean): AIProvider[] {
  const order = ROUTING[taskType] || ROUTING.unknown
  return order
    .map((name) => REGISTRY[name])
    .filter((p): p is AIProvider => !!p)
    .filter((p) => p.isAvailable())
    .filter((p) => !needsVision || p.supportsVision)
    // Search grounding is a Gemini-only feature — if this call needs
    // it, only Gemini is a valid candidate, full stop. No silent
    // degradation to a provider that would just ignore the request.
    .filter((p) => !needsSearch || p.name === 'gemini')
}

export async function generateAI(prompt: string, options: GenerateOptions = {}): Promise<GenerateResult> {
  const taskType = options.taskType || 'unknown'
  const needsVision = !!(options.images && options.images.length > 0)
  const timeoutMs = options.timeoutMs || 20000

  if (options.forceProvider) {
    const p = REGISTRY[options.forceProvider]
    if (!p || !p.isAvailable()) throw new Error(`Forced provider "${options.forceProvider}" is unavailable`)
    return withTimeout(p.generate(prompt, options), timeoutMs, p.name)
  }

  const providers = pickProviders(taskType, needsVision, !!options.useSearch)
  if (providers.length === 0) {
    throw new Error('No AI providers available for this request (check API keys / task requirements)')
  }

  console.log(`AI Router: Task detected: ${taskType}`)

  let lastError: unknown = null
  for (const provider of providers) {
    console.log(`Trying ${provider.name}...`)
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const result = await withTimeout(provider.generate(prompt, options), timeoutMs, provider.name)
        console.log(`${provider.name} succeeded.`)
        return result
      } catch (err) {
        lastError = err
        const status = err instanceof ProviderError ? err.status : undefined
        const reason = status === 429 ? 'quota exceeded' : status ? `error ${status}` : 'failed'
        console.log(`${provider.name} ${reason}${attempt === 0 && isRetryable(err) ? ' — retrying once...' : ''}`)
        if (attempt === 0 && isRetryable(err)) continue
        break
      }
    }
  }

  console.log('AI Router: all providers exhausted.')
  throw new Error(
    `All AI providers failed for task "${taskType}". Last error: ${lastError instanceof Error ? lastError.message : String(lastError)}`
  )
}
