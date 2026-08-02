import { AIProvider, GenerateOptions } from '../types.ts'
import { openAICompatibleGenerate } from './_openaiCompatible.ts'

const MISTRAL_API_KEY = Deno.env.get('MISTRAL_API_KEY')
// mistral-small-latest is the right pick for the free Experiment tier —
// full Mistral Large access exists on paper but free-tier rate limits
// make the smaller model far more reliable for regular use.
const MODEL = 'mistral-small-latest'

export const mistralProvider: AIProvider = {
  name: 'mistral',
  supportsVision: false,
  isAvailable: () => !!MISTRAL_API_KEY,
  generate: (prompt: string, options: GenerateOptions) =>
    openAICompatibleGenerate('mistral', 'https://api.mistral.ai/v1/chat/completions', MISTRAL_API_KEY!, MODEL, prompt, options),
}
