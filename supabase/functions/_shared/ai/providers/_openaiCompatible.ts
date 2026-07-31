import { GenerateOptions, GenerateResult, ProviderError } from '../types.ts'

export async function openAICompatibleGenerate(
  providerName: string,
  baseUrl: string,
  apiKey: string,
  model: string,
  prompt: string,
  options: GenerateOptions,
  capabilities: { supportsJsonMode: boolean },
  extraHeaders: Record<string, string> = {}
): Promise<GenerateResult> {
  const { systemPrompt = '', history = [], temperature = 0.8, jsonMode = false, maxTokens = 2000 } = options

  const messages = [
    ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
    ...history.map((m) => ({ role: m.role, content: m.content })),
    { role: 'user', content: prompt },
  ]

  const body: any = { model, messages, temperature, max_tokens: maxTokens }
  if (jsonMode && capabilities.supportsJsonMode) {
    body.response_format = { type: 'json_object' }
  }

  let response: Response
  try {
    response = await fetch(baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}`, ...extraHeaders },
      body: JSON.stringify(body),
    })
  } catch (e) {
    throw new ProviderError(`network error: ${(e as Error).message}`)
  }

  if (!response.ok) {
    const errText = await response.text().catch(() => '')
    throw new ProviderError(`${providerName} ${response.status}: ${errText.slice(0, 200)}`, response.status)
  }

  const data = await response.json()
  const text = data.choices?.[0]?.message?.content || ''
  return { text, provider: providerName }
}
