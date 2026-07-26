import { GenerateOptions, GenerateResult, ProviderError } from '../types.ts'

export async function openAICompatibleGenerate(
  providerName: string,
  baseUrl: string,
  apiKey: string,
  model: string,
  prompt: string,
  options: GenerateOptions,
  extraHeaders: Record<string, string> = {}
): Promise<GenerateResult> {
  const { systemPrompt = '', history = [], temperature = 0.8 } = options

  const messages = [
    ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
    ...history.map((m) => ({ role: m.role, content: m.content })),
    { role: 'user', content: prompt },
  ]

  let response: Response
  try {
    response = await fetch(baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        ...extraHeaders,
      },
      body: JSON.stringify({ model, messages, temperature, max_tokens: 1200 }),
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
