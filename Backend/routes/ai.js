const express = require('express');
const { auth } = require('../middleware/auth');

const router = express.Router();

const GROQ_MODELS = [
  'llama3-70b-8192',
  'gpt-oss-20b',
  'meta-llama/llama-4-scout-17b-16e-instruct',
];
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

/**
 * POST /api/ai/chat
 * Proxies the chat request to Groq, keeping the API key server-side.
 * Body: { messages, systemPrompt }
 */
router.post('/chat', auth, async (req, res) => {
  const { messages, systemPrompt, tools } = req.body;
  const apiKey = req.headers['x-groq-api-key'] || process.env.GROQ_API_KEY;

  if (!apiKey) {
    return res.status(503).json({ error: 'AI service not configured. Set GROQ_API_KEY env variable or configure in Settings.' });
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
          tools: tools && tools.length > 0 ? tools : undefined,
          temperature: 0.7,
          max_tokens: 1024,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const message = data.choices?.[0]?.message;
        const text = message?.content;
        const tool_calls = message?.tool_calls;
        
        if (text || tool_calls) {
          return res.json({ text, tool_calls, message });
        }
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
  const { base64Image, mimeType, images } = req.body;
  const apiKey = req.headers['x-groq-api-key'] || process.env.GROQ_API_KEY;

  if (!apiKey) {
    return res.status(503).json({ error: 'AI service not configured. Set GROQ_API_KEY env variable or configure in Settings.' });
  }

  let imageList = [];
  if (images && Array.isArray(images) && images.length > 0) {
    imageList = images;
  } else if (base64Image && mimeType) {
    imageList = [{ base64Image, mimeType }];
  }

  if (imageList.length === 0) {
    return res.status(400).json({ error: 'base64Image/mimeType or images array is required' });
  }

  const VISION_MODELS = [
    'llama-3.2-90b-vision-preview',
    'llama-3.2-11b-vision-preview',
    'meta-llama/llama-4-scout-17b-16e-instruct'
  ];

  let lastError = null;
  const maxRetries = 3;

  for (const model of VISION_MODELS) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
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
              {
                role: 'user',
                content: [
                  ...imageList.map(img => ({
                    type: 'image_url',
                    image_url: { url: `data:${img.mimeType};base64,${img.base64Image}` },
                  })),
                  {
                    type: 'text',
                    text: `You are an expert document parser specializing in Indian invoices, Goods Receipt Notes (GRNs), and delivery challans.

Your task is to carefully extract structured data from the document image provided and return it as ONLY valid JSON.

---
## STEP 1: IDENTIFY THE DOCUMENT HEADER
Look for the following fields anywhere on the document (usually at the top):
- **Supplier / Vendor Name**: The company that is SELLING the goods (not the buyer). Look for labels like "From:", "Supplier:", "Vendor:", or the bold company name at the top.
- **PO Number / Invoice Number**: Look for "PO No.", "Invoice No.", "Bill No.", "Ref No.", etc.
- **Date**: The invoice or delivery date. Format it as YYYY-MM-DD. If only day/month/year is shown (e.g., "20/08/2021"), convert to "2021-08-20".

---
## STEP 2: EXTRACT EVERY LINE ITEM FROM THE TABLE (VERY IMPORTANT)
The document will have a table of items. Scan EVERY row from top to bottom. DO NOT SKIP any row.
For EACH row, extract:
- **hsn**: The HSN/SAC code (a 4-8 digit number). May be in a column labelled "HSN", "HSN/SAC", "SAC Code", etc.
- **description**: The full product name/description. Include brand, size, color, model if visible.
- **quantity**: The number of units received. Look for columns labelled "Qty", "Quantity", "Nos", "Pcs", etc. Must be a NUMBER.
- **unit_price**: The price per unit BEFORE tax. Look for "Rate", "Unit Price", "Price/Unit", "MRP". Must be a NUMBER or null.
- **total_amount**: The total value for that line item. This is usually the last numeric column. It may be BEFORE or AFTER tax depending on the document. Must be a NUMBER or null.

---
## STEP 3: VALIDATION RULES (Apply these before returning)
1. **Math Check**: If you have all three values (quantity, unit_price, total_amount), verify that quantity × unit_price ≈ total_amount (allow ±2% for rounding). If the math does NOT check out, the most likely culprits are:
   a. The total_amount includes tax (GST 18%) → Try: unit_price × quantity × 1.18 ≈ total_amount
   b. You misread a digit → Re-examine the image for that row carefully.
   c. There is a discount applied → Note this in the description if visible.
2. **Quantity must be a positive number**. If you see "-" or blank, set it to null.
3. **Unit price must be a positive number**. If only total_amount is visible and not unit_price, calculate: unit_price = total_amount / quantity (if quantity > 0), else set to null.
4. **Never invent or guess data**. If a value is truly not visible, use null.
5. **Remove commas from numbers**: "1,234.56" → 1234.56. "2,374.70" → 2374.70.
6. **Handle merged cells and summary rows**: Rows that say "Total", "Sub Total", "Grand Total", "CGST", "SGST", "Freight", "Discount" are NOT line items — exclude them from the items array.

---
## STEP 4: EDGE CASES
- If the document is a multi-page invoice and you can only see one page, extract what is visible.
- If the supplier name appears twice (e.g., letterhead and body), use the one associated with "Bill From" or "Supplier".
- Indian company names often have suffixes like "Pvt. Ltd.", "Ltd.", "& Co.", "Enterprises", "Traders", "M/s." — keep them exactly as printed.
- Dates in Indian format: DD/MM/YYYY → convert to YYYY-MM-DD (e.g., 15/03/2024 → 2024-03-15).
- HSN codes for ceramics/sanitary ware are typically 6910xxxx. Plumbing pipes are 3917xxxx or 7304xxxx.

---
## OUTPUT FORMAT
Return ONLY this JSON structure with NO extra text, NO markdown, NO explanation:
{
  "supplier_name": "string or null",
  "po_number": "string or null",
  "date": "YYYY-MM-DD string or null",
  "items": [
    {
      "hsn": "string or null",
      "description": "Full product description",
      "quantity": number,
      "unit_price": number or null,
      "total_amount": number or null
    }
  ]
}`,
                  },
                ],
              },
            ],
            temperature: 0.1,
            max_tokens: 4096,
            response_format: { type: 'json_object' }
          }),
        });

        if (!response.ok) {
          const err = await response.json().catch(() => ({}));
          lastError = new Error(err.error?.message || 'Vision API failed');
          if (response.status === 503 || response.status === 429) {
             // Exponential backoff
             if (attempt < maxRetries) {
               const delay = Math.pow(2, attempt) * 1000;
               console.log(`Groq over capacity. Retrying ${model} in ${delay}ms... (Attempt ${attempt})`);
               await new Promise(res => setTimeout(res, delay));
               continue;
             }
          }
          break; // break retry loop for other errors, try next model if any
        }

        const data = await response.json();
        const text = data.choices?.[0]?.message?.content;
        if (!text) {
          lastError = new Error('Empty vision response');
          break;
        }

        let clean = text.replace(/```json/g, '').replace(/```/g, '').trim();
        const firstBrace = clean.indexOf('{');
        const lastBrace = clean.lastIndexOf('}');
        if (firstBrace !== -1 && lastBrace !== -1) {
          clean = clean.substring(firstBrace, lastBrace + 1);
        }
        
        // Fix trailing commas
        clean = clean.replace(/,\s*([}\]])/g, '$1');

        try {
          const parsed = JSON.parse(clean);

          // ─── POST-PROCESSING: Auto-correct & sanitise AI output ───────────────
          if (Array.isArray(parsed.items)) {
            const SUMMARY_ROW_KEYWORDS = /^(total|sub.?total|grand.?total|cgst|sgst|igst|tax|freight|discount|charges?|round.?off|advance|balance|amount|narration|description)$/i;

            parsed.items = parsed.items
              .filter(item => {
                // Remove summary/tax rows — they have no real product description
                const desc = (item.description || '').trim();
                return desc && !SUMMARY_ROW_KEYWORDS.test(desc);
              })
              .map(item => {
                const qty   = parseFloat(item.quantity)    || null;
                const rate  = parseFloat(item.unit_price)  || null;
                const total = parseFloat(item.total_amount)|| null;

                // If unit_price is missing but we have qty and total, derive it
                if (!rate && qty && qty > 0 && total) {
                  item.unit_price = parseFloat((total / qty).toFixed(4));
                }

                // If total_amount is missing but we have qty and rate, derive it
                if (!total && qty && rate) {
                  item.total_amount = parseFloat((qty * rate).toFixed(2));
                }

                // Ensure numbers are numbers, not strings
                if (item.quantity)    item.quantity    = parseFloat(item.quantity);
                if (item.unit_price)  item.unit_price  = parseFloat(item.unit_price);
                if (item.total_amount)item.total_amount = parseFloat(item.total_amount);

                return item;
              });
          }

          // Normalise date: accept DD/MM/YYYY or DD-MM-YYYY → YYYY-MM-DD
          if (parsed.date && typeof parsed.date === 'string') {
            const dmyMatch = parsed.date.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
            if (dmyMatch) {
              const [, d, m, y] = dmyMatch;
              const fullYear = y.length === 2 ? '20' + y : y;
              parsed.date = `${fullYear}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`;
            }
          }
          // ─────────────────────────────────────────────────────────────────────

          return res.json(parsed);
        } catch (parseErr) {
          console.error("JSON parse error with model", model, ":", parseErr, "Raw Text:", clean);
          lastError = new Error(`Could not parse AI response perfectly from ${model}.`);
          break; // The response was bad, try another model
        }
      } catch (err) {
        lastError = err;
        if (attempt < maxRetries) {
          const delay = Math.pow(2, attempt) * 1000;
          await new Promise(res => setTimeout(res, delay));
          continue;
        }
        break;
      }
    }
  }

  // If we exhaust all models and retries
  res.status(502).json({ error: lastError?.message || 'Vision API failed after multiple retries.' });
});

const callGroq = async (systemPrompt, userMessage, apiKey) => {
  let lastError = null;
  const maxRetries = 3;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(GROQ_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user',   content: userMessage  }
          ],
          temperature: 0.4,
          max_tokens: 2048
        })
      })
      const data = await response.json()
      if (!response.ok) {
        lastError = new Error(data.error?.message || 'Groq API error')
        if (response.status === 503 || response.status === 429) {
          if (attempt < maxRetries) {
            const delay = Math.pow(2, attempt) * 1000;
            await new Promise(res => setTimeout(res, delay));
            continue;
          }
        }
        throw lastError;
      }
      return data.choices?.[0]?.message?.content
    } catch (err) {
      lastError = err;
      if (attempt < maxRetries) {
        const delay = Math.pow(2, attempt) * 1000;
        await new Promise(res => setTimeout(res, delay));
        continue;
      }
      throw lastError;
    }
  }
}

// ─────────────────────────────────────────────
// ENDPOINT 1: Executive Summary (Dashboard)
// POST /api/ai/executive-summary
// ─────────────────────────────────────────────
router.post('/executive-summary', auth, async (req, res) => {
  try {
    const { inventory, bills, transactions, quotations, apiKey: reqApiKey } = req.body
    const apiKey = reqApiKey || req.headers['x-groq-api-key'] || process.env.GROQ_API_KEY;

    if (!apiKey) return res.status(503).json({ error: 'AI service not configured.' });

    // Calculate key metrics
    const totalRevenue = (bills||[])
      .filter(b => b.payment_status === 'Paid' || b.paymentStatus === 'Paid')
      .reduce((s, b) => s + (b.grand_total || b.grandTotal || 0), 0)

    const outstanding = (bills||[])
      .filter(b => b.payment_status !== 'Paid' && b.paymentStatus !== 'Paid')
      .reduce((s, b) => s + (b.grand_total || b.grandTotal || 0), 0)

    const lowStockItems = (inventory||[])
      .filter(i => i.qty <= i.min)
      .map(i => i.name)

    const topCustomers = Object.entries(
      (bills||[]).reduce((acc, b) => {
        const cname = b.customer_name || b.customerName
        if (cname) acc[cname] = (acc[cname] || 0) + (b.grand_total || b.grandTotal || 0)
        return acc
      }, {})
    )
    .sort((a,b) => b[1] - a[1])
    .slice(0, 3)
    .map(([name, amt]) => `${name}: ₹${Number(amt).toLocaleString('en-IN')}`)

    const systemPrompt = `
You are OpsAgent, an expert AI business analyst for small Indian service businesses.
Analyze the provided business data and give a clear, actionable executive summary.

Format your response with these sections:
1. 🏥 Business Health (1-2 sentences, overall status)
2. 💰 Revenue & Cash (key financial metrics)
3. 📦 Inventory (stock concerns if any)
4. 👥 Top Customers (who's driving revenue)
5. ⚠️ Action Items (2-3 specific things to do NOW)

Keep each section concise — 2-3 sentences max.
Use Indian Rupee format (₹).
Be direct and specific, not generic.
Tone: professional but conversational.`

    const userMessage = `
Analyze this business data and generate an executive summary:

FINANCIAL OVERVIEW:
- Total Revenue (Paid Bills): ₹${Number(totalRevenue).toLocaleString('en-IN')}
- Outstanding Receivables: ₹${Number(outstanding).toLocaleString('en-IN')}
- Total Bills: ${(bills||[]).length}
- Total Quotations: ${(quotations||[]).length}

TOP 3 CUSTOMERS BY REVENUE:
${topCustomers.join('\n')}

INVENTORY STATUS:
- Total SKUs: ${(inventory||[]).length}
- Low Stock Items: ${lowStockItems.length}
- Low Stock: ${lowStockItems.slice(0,5).join(', ') || 'None'}

RECENT TRANSACTIONS (last 10):
${JSON.stringify((transactions||[]).slice(0,10), null, 2)}

Generate a comprehensive executive summary.`

    const insight = await callGroq(systemPrompt, userMessage, apiKey)

    res.json({ success: true, insight })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ─────────────────────────────────────────────
// ENDPOINT 2: Report Insights
// POST /api/ai/report-insight
// ─────────────────────────────────────────────
router.post('/report-insight', auth, async (req, res) => {
  try {
    const { reportType, reportData, apiKey: reqApiKey } = req.body
    const apiKey = reqApiKey || req.headers['x-groq-api-key'] || process.env.GROQ_API_KEY;

    if (!apiKey) return res.status(503).json({ error: 'AI service not configured.' });

    const systemPrompts = {
      sales: `
You are an expert sales analyst for a small Indian business. Analyze the sales report data and provide actionable insights.
Focus on: revenue trends, top performers, concerning patterns, and specific action items.
Format with bullet points. Be specific with numbers. Use ₹ for currency.`,
      inventory: `
You are an expert inventory manager for a small Indian business. Analyze the stock data.
Focus on: critical low stock, overstock items, slow-moving inventory, reorder recommendations.
Format with bullet points. Be specific.`,
      gst: `
You are a GST compliance expert for Indian businesses. Analyze the tax data.
Focus on: total tax liability, unusual patterns, filing readiness, compliance notes.
Format with bullet points. Use Indian tax terms.`,
      customers: `
You are a CRM expert for small Indian businesses. Analyze the customer data.
Focus on: top customers, payment behavior, at-risk customers, growth opportunities.
Format with bullet points. Be specific.`
    }

    const reportLabels = {
      sales: 'Sales Report',
      inventory: 'Inventory Report',
      gst: 'GST Tax Report',
      customers: 'Customer Report'
    }

    const userMessage = `
Analyze this ${reportLabels[reportType]} and provide key insights:

${JSON.stringify(reportData, null, 2)}

Provide 4-6 specific, actionable insights.
Each insight should start with an emoji.
End with 2 specific "Action Items" to take.`

    const insight = await callGroq(systemPrompts[reportType] || systemPrompts.sales, userMessage, apiKey)

    res.json({ success: true, insight })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ─────────────────────────────────────────────
// ENDPOINT 3: Ask AI (Report Chat)
// POST /api/ai/ask-report
// ─────────────────────────────────────────────
router.post('/ask-report', auth, async (req, res) => {
  try {
    const { reportType, reportData, question, chatHistory, apiKey: reqApiKey } = req.body
    const apiKey = reqApiKey || req.headers['x-groq-api-key'] || process.env.GROQ_API_KEY;

    if (!apiKey) return res.status(503).json({ error: 'AI service not configured.' });

    const systemPrompt = `
You are OpsAgent AI, a business analyst assistant for a small Indian service business.

You have access to the following ${reportType} report data:
${JSON.stringify(reportData, null, 2)}

Answer questions ONLY based on this data.
If the data doesn't contain the answer, say so.
Be specific with numbers and names.
Use ₹ for currency, Indian number format.
Keep answers concise — 3-5 sentences max.
If asked for a list, use bullet points.`

    const messages = [
      ...(chatHistory || []).map(m => ({ role: m.role, content: m.content })),
      { role: 'user', content: question }
    ]

    let answer = 'No answer received.';
    let lastError = null;
    const maxRetries = 3;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await fetch(GROQ_API_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model: 'llama-3.3-70b-versatile',
            messages: [
              { role: 'system', content: systemPrompt },
              ...messages
            ],
            temperature: 0.3,
            max_tokens: 1024
          })
        })

        const data = await response.json()
        if (!response.ok) {
          lastError = new Error(data.error?.message || 'Groq API error')
          if (response.status === 503 || response.status === 429) {
            if (attempt < maxRetries) {
              const delay = Math.pow(2, attempt) * 1000;
              await new Promise(res => setTimeout(res, delay));
              continue;
            }
          }
          throw lastError;
        }
        answer = data.choices?.[0]?.message?.content || answer;
        break; // success
      } catch (err) {
        lastError = err;
        if (attempt < maxRetries) {
          const delay = Math.pow(2, attempt) * 1000;
          await new Promise(res => setTimeout(res, delay));
          continue;
        }
        throw lastError;
      }
    }

    res.json({ success: true, answer })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})
// ─────────────────────────────────────────────
// ENDPOINT 4: Category-wise Inventory Insight
// POST /api/ai/category-insight
// ─────────────────────────────────────────────
router.post('/category-insight', auth, async (req, res) => {
  try {
    const { categoryData, period, apiKey: reqApiKey } = req.body;
    const apiKey = reqApiKey || req.headers['x-groq-api-key'] || process.env.GROQ_API_KEY;

    if (!apiKey) return res.status(503).json({ error: 'AI service not configured.' });

    const periodLabels = { week: 'This Week', month: 'This Month', quarter: 'This Quarter', year: 'This Year' };

    const systemPrompt = `
You are an expert inventory analyst for a small Indian business. Analyze the category-wise inventory data and provide specific, actionable insights.

Focus on:
- Which categories are performing best vs worst
- Stock health per category (low stock, overstock, dead stock)
- Categories needing immediate attention
- Reorder recommendations with priority
- Sales trends per category (based on sold quantities)
- Cash locked in overstock situations
- Fast-moving vs slow-moving categories

Use Indian Rupee format (₹). Be specific with numbers and category names.
Format with clear bullet points. Keep it practical and immediately actionable.`;

    const dataStr = (categoryData || []).map(c => `
Category: ${c.category}
- Items: ${c.totalItems}, Total Stock Value: ₹${Math.round(c.totalValue).toLocaleString('en-IN')}
- Total Qty: ${c.totalQty}, Sold (period): ${c.soldQty} units, Sold Value: ₹${Math.round(c.soldValue).toLocaleString('en-IN')}
- Low Stock: ${c.lowStockCount}, Out of Stock: ${c.outOfStockCount}, Overstock: ${c.overstockCount}`
    ).join('\n');

    const userMessage = `Analyze this category-wise inventory report for ${periodLabels[period] || 'This Month'}:

${dataStr}

Provide insights on:
1. Overall inventory health by category
2. Best and worst performing categories  
3. Categories with stock issues requiring attention
4. Specific reorder recommendations (which categories, priority order)
5. Revenue opportunities (fast moving categories)
6. Cash locked in overstock (categories to reduce ordering)

End with 3 specific numbered action items the business owner should do TODAY.`;

    const insight = await callGroq(systemPrompt, userMessage, apiKey);
    res.json({ success: true, insight });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
