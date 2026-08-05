import { AIProvider, GenerateOptions } from '../types.ts'
import { openAICompatibleGenerate } from './_openaiCompatible.ts'

const NVIDIA_API_KEY = Deno.env.get('NVIDIA_API_KEY')
// NIM free tier is ~40 RPM with a finite credit pool (not per-token
// unlimited) — fine as a fallback layer, not meant to carry primary load.
const MODEL = 'meta/llama-3.1-8b-instruct'

export const nvidiaProvider: AIProvider = {
  name: 'nvidia',
  supportsVision: false,
  supportsJsonMode: false,
  isAvailable: () => !!NVIDIA_API_KEY,
  generate: (prompt: string, options: GenerateOptions) =>
    openAICompatibleGenerate('nvidia', 'https://integrate.api.nvidia.com/v1/chat/completions', NVIDIA_API_KEY!, MODEL, prompt, options),
}
