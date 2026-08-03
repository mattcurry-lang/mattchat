import { AIProvider, GenerateOptions, GenerateResult, ProviderError } from '../types.ts'

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY')
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`

async function callGemini(prompt: string, options: GenerateOptions): Promise<GenerateResult> {
  const { systemPrompt = '', history = [], temperature = 0.8, useSearch = false, images = [], fileUri, jsonMode = false, maxTokens = 2000 } = options

  const contents: any[] = history.map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }))

  const finalParts: any[] = [{ text: prompt }]
  for (const img of images) {
    finalParts.push({ inline_data: { mime_type: img.mimeType, data: img.data } })
  }
  if (fileUri) {
    finalParts.push({ file_data: { file_uri: fileUri } })
  }
  contents.push({ role: 'user', parts: finalParts })

  const generationConfig: any = { temperature, maxOutputTokens: maxTokens }
  if (jsonMode) generationConfig.responseMimeType = 'application/json'

  const requestBody: any = { contents, generationConfig }
  if (systemPrompt) requestBody.system_instruction = { parts: [{ text: systemPrompt }] }
  if (useSearch) requestBody.tools = [{ google_search: {} }]

  let response: Response
  try {
    response = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    })
  } catch (e) {
    throw new ProviderError(`network error: ${(e as Error).message}`)
  }

  if (!response.ok) {
    const errText = await response.text().catch(() => '')
    throw new ProviderError(`Gemini ${response.status}: ${errText.slice(0, 200)}`, response.status)
  }

  const data = await response.json()
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || ''

  // --- UPDATE PLACED HERE ---
  const usage = data.usageMetadata ? {
    promptTokens: data.usageMetadata.promptTokenCount || 0,
    completionTokens: data.usageMetadata.candidatesTokenCount || 0,
    totalTokens: data.usageMetadata.totalTokenCount || 0,
  } : undefined

  return { text, provider: 'gemini', usage }
}
