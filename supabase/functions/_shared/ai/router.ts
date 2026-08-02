import { geminiProvider } from './providers/gemini.ts'
import { groqProvider } from './providers/groq.ts'
import { openrouterProvider } from './providers/openrouter.ts'
import { cerebrasProvider } from './providers/cerebras.ts'
import { AIProvider, GenerateOptions, GenerateResult, ProviderError, TaskType } from './types.ts'
import { mistralProvider } from './providers/mistral.ts'
import { nvidiaProvider } from './providers/nvidia.ts'
import { cloudflareProvider } from './providers/cloudflare.ts'

const REGISTRY: Record<string, AIProvider> = {
  gemini: geminiProvider,
  groq: groqProvider,
  openrouter: openrouterProvider,
  cerebras: cerebrasProvider,
  mistral: mistralProvider,
  nvidia: nvidiaProvider,
  cloudflare: cloudflareProvider,
}

// Order matters: first available + capable provider wins.
const ROUTING: Record<TaskType, string[]> = {
  chat: ['groq', 'gemini', 'openrouter', 'cerebras'],
  coding: ['groq', 'gemini', 'openrouter', 'cerebras'],
  quick: ['groq', 'gemini', 'openrouter', 'cerebras'],
  general_reasoning: ['groq', 'gemini', 'openrouter', 'cerebras'],
  email_summary: ['gemini', 'groq', 'openrouter', 'cerebras'],
  document_analysis: ['gemini'],
  image_understanding: ['gemini'],
  vision: ['gemini'],
  video_analysis: ['gemini'],   // ← ADD THIS — Gemini is the only provider that can accept fileUri
  unknown: ['groq', 'gemini', 'openrouter', 'cerebras'],
}

// Slow task types get more room before we give up on a provider.
const TIMEOUTS: Partial<Record<TaskType, number>> = {
  document_analysis: 45000,
  video_analysis: 60000,
  image_understanding: 30000,
  vision: 30000,
}

const RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504])

function isRetryable(err: unknown): boolean {
  if (err instanceof ProviderError) {
    if (err.status && RETRYABLE_STATUSES.has(err.status)) return true
    if (!err.status) return true // network/timeout errors — worth one retry
    return false // e.g. 400 bad request — retrying won't help
  }
  return true
}

function withTimeout<T>(promise: Promise<T>, ms: number, providerName: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new ProviderError(`${providerName} timed out after ${ms}ms`)), ms)
    promise.then((v) => { clearTimeout(timer); resolve(v) }, (e) => { clearTimeout(timer); reject(e) })
  })
}

function pickProviders(taskType: TaskType, needsVision: boolean, needsSearch: boolean, forceProvider?: string): AIProvider[] {
  if (forceProvider) {
    const p = REGISTRY[forceProvider]
    if (!p) throw new Error(`Unknown provider "${forceProvider}"`)
    if (!p.isAvailable()) throw new Error(`Forced provider "${forceProvider}" is unavailable`)
    if (needsVision && !p.supportsVision) throw new Error(`Forced provider "${forceProvider}" can't handle file/image input`)
    return [p]
  }

  const order = ROUTING[taskType] || ROUTING.unknown
  return order
    .map((name) => REGISTRY[name])
    .filter((p): p is AIProvider => !!p)
    .filter((p) => p.isAvailable())
    .filter((p) => !needsVision || p.supportsVision)
    .filter((p) => !needsSearch || p.name === 'gemini') // only Gemini does search grounding here
}

export async function generateAI(prompt: string, options: GenerateOptions = {}): Promise<GenerateResult> {
  const taskType = options.taskType || 'unknown'
  const needsVision = !!(options.images?.length || options.fileUri)
  const timeoutMs = options.timeoutMs || TIMEOUTS[taskType] || 20000

  const providers = pickProviders(taskType, needsVision, !!options.useSearch, options.forceProvider)
  if (providers.length === 0) {
    throw new Error(`No AI providers available for task "${taskType}" (check API keys / vision requirement)`)
  }

  console.log(`AI Router: task=${taskType} candidates=${providers.map((p) => p.name).join(',')}`)

  let lastError: unknown = null
  for (const provider of providers) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const result = await withTimeout(provider.generate(prompt, options), timeoutMs, provider.name)
        console.log(`AI Router: ${provider.name} succeeded`)
        return result
      } catch (err) {
        lastError = err
        const status = err instanceof ProviderError ? err.status : undefined
        const reason = status === 429 ? 'quota exceeded' : status ? `error ${status}` : 'failed/timed out'
        console.log(`AI Router: ${provider.name} ${reason}${attempt === 0 && isRetryable(err) ? ' — retrying once' : ' — moving to next provider'}`)
        if (attempt === 0 && isRetryable(err)) continue
        break
      }
    }
  }

  console.error(`AI Router: all providers exhausted for task "${taskType}"`)
  throw new Error(
    `All AI providers failed for task "${taskType}". Last error: ${lastError instanceof Error ? lastError.message : String(lastError)}`
  )
}
