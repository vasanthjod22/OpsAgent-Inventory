# OpsAgent — AI Back-Office Manager

AI-powered back-office management system for small
service businesses (logistics, construction, utilities).

---

## Problem It Solves

Small service businesses juggle WhatsApp, paper GRNs,
Excel sheets, and manual stock logs instead of a real
back-office system. OpsAgent replaces all of that with
a single AI agent that acts as a digital operations manager.

---

## Features

- 🔐 Authentication — Signup, Login, Forgot Password with OTP
- 💰 Finance Snapshot — Upload CSV, AI generates weekly summary
- 📄 GRN OCR Upload — Photo or PDF, AI extracts all line items
- 📦 Smart Inventory — Auto stock updates from GRN approvals
- 💬 AI Chat — Ask questions about your business data
- 🌐 Tamil + Handwritten — Multilingual document support

---

## Tech Stack

### Frontend
- React 18 + Vite
- Tailwind CSS
- Lucide React (icons)
- pdfjs-dist (PDF to image conversion)

### AI & Vision
- Groq API (free tier)
- Llama 3.1 8B Instant (text, finance, chat)
- Llama 4 Scout 17B (vision, GRN OCR)

### Storage
- localStorage (all data persistence)
- No backend or database required

### Deployment
- GitHub + Vercel

---

## Setup

1. Clone the repo
   git clone https://github.com/yourusername/opsagent

2. Install dependencies
   npm install

3. Start development server
   npm run dev

4. Open app in browser
   http://localhost:5173

5. Go to Settings (gear icon in sidebar)
   Enter your Groq API key from console.groq.com

---

## Demo Login

Username : demo
Password : demo123

---

## Deploy to Vercel

1. Push to GitHub
2. Go to vercel.com and import your repo
3. Click Deploy (Vite is auto detected)
4. Open live URL
5. Enter Groq API key in Settings

No environment variables needed —
API key is stored safely in localStorage.

---

## Project Structure

opsagent/
├── src/
│   ├── components/
│   │   ├── Sidebar.jsx
│   │   ├── TopBar.jsx
│   │   └── panels/
│   │       ├── DashboardPanel.jsx
│   │       ├── FinancePanel.jsx
│   │       ├── GRNPanel.jsx
│   │       ├── InventoryPanel.jsx
│   │       └── ChatPanel.jsx
│   ├── hooks/
│   │   └── useLocalStorage.js
│   ├── utils/
│   │   ├── api.js (Groq integration)
│   │   └── auth.js (authentication)
│   └── data/
│       └── seedData.js
├── vercel.json
└── README.md

---

## Future Roadmap

- WhatsApp alerts via Evolution API
- SMS notifications via MSG91
- Email reports via SendGrid
- Multi-language support (Tamil, Hindi)
- Mobile app via React Native

---

## Developer

Name    : RAJAVASANTHAN S
College : Karunya Institute Of Technology and Sciences
