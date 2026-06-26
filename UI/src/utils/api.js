import { backendFetch } from './backend'

export const callAI = async (apiKey, messages, systemPrompt, tools = undefined) => {
  try {
    const data = await backendFetch('/ai/chat', {
      method: 'POST',
      headers: {
        'x-groq-api-key': apiKey || localStorage.getItem('opsagent_groq_key') || ''
      },
      body: JSON.stringify({ messages, systemPrompt, tools })
    })
    return data
  } catch (err) {
    throw new Error(err.message || 'AI chat failed')
  }
}

export const callVisionAI = async (apiKey, base64ImageOrArray, mimeType) => {
  try {
    const payload = Array.isArray(base64ImageOrArray)
      ? { images: base64ImageOrArray }
      : { base64Image: base64ImageOrArray, mimeType }

    return await backendFetch('/ai/vision', {
      method: 'POST',
      headers: {
        'x-groq-api-key': apiKey || localStorage.getItem('opsagent_groq_key') || ''
      },
      body: JSON.stringify(payload)
    })
  } catch (err) {
    throw new Error(err.message || 'Vision API failed')
  }
}
