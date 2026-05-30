const GROQ_MODELS = [
  'llama3-70b-8192',
  'llama-3.1-8b-instant',
  'meta-llama/llama-4-scout-17b-16e-instruct'
]

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions'

export const callAI = async (apiKey, messages, systemPrompt) => {
  let lastError = null

  for (const model of GROQ_MODELS) {
    try {
      const response = await fetch(GROQ_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: model,
          messages: [
            { role: 'system', content: systemPrompt },
            ...messages
          ],
          temperature: 0.7,
          max_tokens: 1024
        })
      })

      if (response.ok) {
        const data = await response.json()
        const text = data.choices?.[0]?.message?.content
        if (text) return text
        console.warn(`Model ${model} empty response, trying next...`)
        continue
      } else {
        const err = await response.json().catch(() => ({}))
        console.warn(`Model ${model} failed:`, err.error?.message)
        lastError = new Error(err.error?.message || 'API Error')
        continue
      }
    } catch (err) {
      console.warn(`Fetch failed for ${model}:`, err.message)
      lastError = err
      continue
    }
  }

  throw lastError || new Error(
    'All models failed. Please check your API key in Settings.'
  )
}

export const callVisionAI = async (apiKey, base64Image, mimeType) => {
  const response = await fetch(
    'https://api.groq.com/openai/v1/chat/completions',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'meta-llama/llama-4-scout-17b-16e-instruct',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image_url',
                image_url: {
                  url: `data:${mimeType};base64,${base64Image}`
                }
              },
              {
                type: 'text',
                text: `Extract all data from this Goods Receipt Note (GRN) 
                or delivery document. The document may be in English 
                or Tamil or handwritten.
                
                Return ONLY valid JSON with this exact structure:
                {
                  "supplier_name": "string or null",
                  "grn_number": "string or null", 
                  "po_number": "string or null",
                  "date": "string or null",
                  "items": [
                    {
                      "sku": "string or null",
                      "description": "string",
                      "quantity": number or null,
                      "unit": "string or null",
                      "unit_price": number or null
                    }
                  ]
                }
                
                If a field is unclear or not found return null.
                Return ONLY the JSON, no extra text.`
              }
            ]
          }
        ],
        temperature: 0.1,
        max_tokens: 1024
      })
    }
  )

  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    throw new Error(
      err.error?.message || 'Vision API failed'
    )
  }

  const data = await response.json()
  const text = data.choices?.[0]?.message?.content

  if (!text) throw new Error('Empty response from Vision AI')

  // Parse JSON safely
  try {
    const clean = text
      .replace(/```json/g, '')
      .replace(/```/g, '')
      .trim()
    return JSON.parse(clean)
  } catch {
    throw new Error('Could not parse extracted data. Please try again.')
  }
}
