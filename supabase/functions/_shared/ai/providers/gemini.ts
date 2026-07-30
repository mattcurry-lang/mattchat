import { AIProvider, GenerateOptions, GenerateResult, ProviderError } from '../types.ts'

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY')
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`

async function callGemini(prompt: string, options: GenerateOptions): Promise<GenerateResult> {
  const { systemPrompt = '', history = [], temperature = 0.8, useSearch = false, images = [] } = options

  const contents: any[] = [
    { role: 'user', parts: [{ text: `[System: ${systemPrompt}]\n\nAcknowledge your role.` }] },
    { role: 'model', parts: [{ text: 'I am Curry — your companion inside Mattchat. I remember, I notice, I care.' }] },
    ...history.map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })),
  ]

  // Vision/document support — images ride alongside the text prompt in
  // the final user turn, exactly how document-analyze already does it.
  const finalParts: any[] = [{ text: prompt }]
  for (const img of images) {
    finalParts.push({ inline_data: { mime_type: img.mimeType, data: img.data } })
  }

  if (options.fileUri) {
   finalParts.push({ file_data: { mime_type: options.fileUri.mimeType, file_uri: options.fileUri.uri } })
 }
  contents.push({ role: 'user', parts: finalParts })

  const requestBody: any = { contents, generationConfig: { temperature, maxOutputTokens: 1200 } }
  if (options.responseFormatJson) requestBody.generationConfig.responseMimeType = 'application/json'
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
  return { text, provider: 'gemini' }
}

export const geminiProvider: AIProvider = {
  name: 'gemini',
  supportsVision: true,
  isAvailable: () => !!GEMINI_API_KEY,
  generate: callGemini,
}
