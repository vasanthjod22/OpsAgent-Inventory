import { backendFetch } from './backend'

export const callAI = async (apiKey, messages, systemPrompt) => {
  try {
    const data = await backendFetch('/ai/chat', {
      method: 'POST',
      body: JSON.stringify({ messages, systemPrompt })
    })
    return data.text
  } catch (err) {
    throw new Error(err.message || 'AI chat failed')
  }
}

export const callVisionAI = async (apiKey, base64Image, mimeType) => {
  try {
    return await backendFetch('/ai/vision', {
      method: 'POST',
      body: JSON.stringify({ base64Image, mimeType })
    })
  } catch (err) {
    throw new Error(err.message || 'Vision API failed')
  }
}
