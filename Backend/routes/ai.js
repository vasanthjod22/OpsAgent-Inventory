const express = require('express');
const { auth } = require('../middleware/auth');

const router = express.Router();

const GROQ_MODELS = [
  'llama3-70b-8192',
  'llama-3.1-8b-instant',
  'meta-llama/llama-4-scout-17b-16e-instruct',
];
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

/**
 * POST /api/ai/chat
 * Proxies the chat request to Groq, keeping the API key server-side.
 * Body: { messages, systemPrompt }
 */
router.post('/chat', auth, async (req, res) => {
  const { messages, systemPrompt } = req.body;
  const apiKey = process.env.GROQ_API_KEY;

  if (!apiKey) {
    return res.status(503).json({ error: 'AI service not configured. Set GROQ_API_KEY env variable.' });
  }
  if (!messages || messages.length === 0) {
    return res.status(400).json({ error: 'messages array is required' });
  }

  let lastError = null;
  for (const model of GROQ_MODELS) {
    try {
      const response = await fetch(GROQ_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: systemPrompt || 'You are a helpful assistant.' },
            ...messages,
          ],
          temperature: 0.7,
          max_tokens: 1024,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const text = data.choices?.[0]?.message?.content;
        if (text) return res.json({ text, model });
        lastError = new Error('Empty response from model');
        continue;
      } else {
        const err = await response.json().catch(() => ({}));
        lastError = new Error(err.error?.message || 'Groq API error');
        continue;
      }
    } catch (err) {
      lastError = err;
      continue;
    }
  }

  res.status(502).json({ error: lastError?.message || 'All AI models failed' });
});

/**
 * POST /api/ai/vision
 * Sends a base64 image to Groq vision for GRN extraction.
 * Body: { base64Image, mimeType }
 */
router.post('/vision', auth, async (req, res) => {
  const { base64Image, mimeType } = req.body;
  const apiKey = process.env.GROQ_API_KEY;

  if (!apiKey) {
    return res.status(503).json({ error: 'AI service not configured. Set GROQ_API_KEY env variable.' });
  }
  if (!base64Image || !mimeType) {
    return res.status(400).json({ error: 'base64Image and mimeType are required' });
  }

  try {
    const response = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'meta-llama/llama-4-scout-17b-16e-instruct',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image_url',
                image_url: { url: `data:${mimeType};base64,${base64Image}` },
              },
              {
                type: 'text',
                text: `Extract all data from this Goods Receipt Note (GRN) or delivery document. Return ONLY valid JSON:
{
  "supplier_name": "string or null",
  "grn_number": "string or null",
  "po_number": "string or null",
  "date": "string or null",
  "items": [{ "sku": "string or null", "description": "string", "quantity": number, "unit": "string or null", "unit_price": number or null }]
}`,
              },
            ],
          },
        ],
        temperature: 0.1,
        max_tokens: 1024,
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      return res.status(502).json({ error: err.error?.message || 'Vision API failed' });
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content;
    if (!text) return res.status(502).json({ error: 'Empty vision response' });

    const clean = text.replace(/```json/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(clean);
    res.json(parsed);
  } catch (err) {
    res.status(502).json({ error: err.message || 'Vision extraction failed' });
  }
});

module.exports = router;
