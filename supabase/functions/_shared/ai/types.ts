export type TaskType =
  | 'chat' | 'coding' | 'quick' | 'general_reasoning'
  | 'email_summary' | 'document_analysis' | 'image_understanding' | 'vision'
  | 'unknown'

export interface HistoryMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface InlineImage {
  mimeType: string
  data: string // base64
}

export interface GenerateOptions {
  systemPrompt?: string
  history?: HistoryMessage[]
  temperature?: number
  useSearch?: boolean        // Gemini-only capability (Google Search grounding)
  images?: InlineImage[] // vision/document tasks — Gemini-only for now
  fileUri?: { mimeType: string; uri: string }  // for Gemini's file_data (e.g. YouTube URL)
  taskType?: TaskType
  timeoutMs?: number
  forceProvider?: string     // escape hatch — bypass routing entirely
  responseFormatJson?: boolean  // maps to generationConfig.responseMimeType
}

export interface GenerateResult {
  text: string
  provider: string
}

// Providers throw this so the router can tell retryable failures
// (rate limits, timeouts, 5xx) apart from permanent ones (bad request).
export class ProviderError extends Error {
  status?: number
  constructor(message: string, status?: number) {
    super(message)
    this.name = 'ProviderError'
    this.status = status
  }
}

export interface AIProvider {
  name: string
  supportsVision: boolean
  isAvailable(): boolean
  generate(prompt: string, options: GenerateOptions): Promise<GenerateResult>
}
