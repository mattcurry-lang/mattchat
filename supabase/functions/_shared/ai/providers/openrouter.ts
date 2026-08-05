import { AIProvider, GenerateOptions } from '../types.ts'
import { openAICompatibleGenerate } from './_openaiCompatible.ts'

const OPENROUTER_API_KEY = Deno.env.get('OPENROUTER_API_KEY')
const MODEL = 'meta-llama/llama-3.3-70b-instruct:free'

export const openrouterProvider: AIProvider = {
  name: 'openrouter',
  supportsVision: false,
  supportsJsonMode: false,
  isAvailable: () => !!OPENROUTER_API_KEY,
  generate: (prompt: string, options: GenerateOptions) =>
    openAICompatibleGenerate(
      'openrouter', 'https://openrouter.ai/api/v1/chat/completions', OPENROUTER_API_KEY!, MODEL, prompt, options,
      { supportsJsonMode: false },
      { 'HTTP-Referer': 'https://mattchat-nine.vercel.app', 'X-Title': 'Mattchat' }
    ),
}
