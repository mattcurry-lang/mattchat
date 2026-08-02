import { AIProvider, GenerateOptions } from '../types.ts'
import { openAICompatibleGenerate } from './_openaiCompatible.ts'

const CLOUDFLARE_API_TOKEN = Deno.env.get('CLOUDFLARE_API_TOKEN')
const CLOUDFLARE_ACCOUNT_ID = Deno.env.get('CLOUDFLARE_ACCOUNT_ID')
const MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast'

// Cloudflare's OpenAI-compatible endpoint is account-scoped, so the
// URL itself needs your account ID baked in — that's the one real
// difference from the other providers here.
const ENDPOINT = CLOUDFLARE_ACCOUNT_ID
  ? `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/ai/v1/chat/completions`
  : ''

export const cloudflareProvider: AIProvider = {
  name: 'cloudflare',
  supportsVision: false,
  isAvailable: () => !!CLOUDFLARE_API_TOKEN && !!CLOUDFLARE_ACCOUNT_ID,
  generate: (prompt: string, options: GenerateOptions) =>
    openAICompatibleGenerate('cloudflare', ENDPOINT, CLOUDFLARE_API_TOKEN!, MODEL, prompt, options),
}
