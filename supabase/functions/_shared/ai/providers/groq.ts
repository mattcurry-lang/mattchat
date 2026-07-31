// groq.ts
import { AIProvider, GenerateOptions } from '../types.ts'
import { openAICompatibleGenerate } from './_openaiCompatible.ts'

const GROQ_API_KEY = Deno.env.get('GROQ_API_KEY')
const MODEL = 'llama-3.3-70b-versatile'

export const groqProvider: AIProvider = {
  name: 'groq',
  supportsVision: false,
  supportsJsonMode: true, // Groq's OpenAI-compatible endpoint honors response_format
  isAvailable: () => !!GROQ_API_KEY,
  generate: (prompt: string, options: GenerateOptions) =>
    openAICompatibleGenerate('groq', 'https://api.groq.com/openai/v1/chat/completions', GROQ_API_KEY!, MODEL, prompt, options, { supportsJsonMode: true }),
}
