export type TaskType =
  | 'chat' | 'coding' | 'quick' | 'general_reasoning'
  | 'email_summary' | 'document_analysis' | 'video_analysis'
  | 'image_understanding' | 'vision'
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
  useSearch?: boolean
  images?: InlineImage[]     // base64 inline_data — PDFs, DOCX, PPTX, photos
  fileUri?: string           // e.g. a YouTube URL, for Gemini's file_data
  jsonMode?: boolean         // ask the provider to return raw JSON, no fences
  maxTokens?: number
  taskType?: TaskType
  timeoutMs?: number
  forceProvider?: string
}

export interface GenerateResult {
  text: string
  provider: string
}

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
  supportsJsonMode: boolean
  generate(prompt: string, options: GenerateOptions): Promise<GenerateResult>
  isAvailable(): boolean
}
