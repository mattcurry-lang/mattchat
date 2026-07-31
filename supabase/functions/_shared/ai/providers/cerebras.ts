// cerebras.ts
import { AIProvider, GenerateOptions } from '../types.ts'
import { openAICompatibleGenerate } from './_openaiCompatible.ts'

const CEREBRAS_API_KEY = Deno.env.get('CEREBRAS_API_KEY')
const MODEL = 'llama3.1-8b'

export const cerebrasProvider: AIProvider = {
  name: 'cerebras',
  supportsVision: false,
  supportsJsonMode: false,
  isAvailable: () => !!CEREBRAS_API_KEY,
  generate: (prompt: string, options: GenerateOptions) =>
    openAICompatibleGenerate('cerebras', 'https://api.cerebras.ai/v1/chat/completions', CEREBRAS_API_KEY!, MODEL, prompt, options, { supportsJsonMode: false }),
}
