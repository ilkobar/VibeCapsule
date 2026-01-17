# VibeCapsule 💊

![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)
![React](https://img.shields.io/badge/React-19-61dafb.svg?style=flat&logo=react)
![Vite](https://img.shields.io/badge/Vite-6.0-646cff.svg?style=flat&logo=vite)
![Chrome Extension](https://img.shields.io/badge/Manifest-V3-4285F4.svg?style=flat&logo=google-chrome)

**VibeCapsule** is a modern, privacy-focused Chrome Extension that distills web chaos into clear, actionable insights. By leveraging advanced LLMs (OpenAI, Anthropic, Gemini) or running entirely on-device with Chrome's built-in AI, it turns lengthy articles into concise summaries, key takeaways, and action items instanlty.

> **Zero Backend. 100% Privacy.**  
> API keys are stored locally in your browser. Usage data goes directly from your browser to the LLM provider—no middleman server.

---

## ✨ Features

- **🧠 Multi-Model Support**: Use your preferred AI: OpenAI (GPT-4o), Anthropic (Claude 3.5 Sonnet), or Google Gemini (1.5 Pro).
- **🔒 Private On-Device AI**: Detects and uses Chrome's experimental `window.ai` (Gemini Nano) for free, completely offline summarization.
- **📚 Read Later Library**: Save summaries and articles locally. Your personal knowledge base, right in the extension.
- **⚡ Smart Workflow**: 
  - **One-Click Summarization**: Automatically extracts readable content from clutter.
  - **Auto-Language**: Detects article language and summarizes *in that language* (or translates titles if specified).
  - **Instant Save**: Transition from "Reading" to "Saved" with a single click.

## 🛠 Tech Stack

Built with the latest 2026 web standards:

- **Core**: React 19, TypeScript, Vite (CRXJS Plugin)
- **UI**: TailwindCSS, Shadcn/UI, Lucide Icons
- **State**: Custom `useStorage` hook for Chrome Sync/Local storage
- **AI Integration**: Direct REST API calls + Chrome Prompt API (`window.ai`)
- **Content Extraction**: `@mozilla/readability`, DOMPurify

## 🚀 Installation

1. **Clone the repo**
   ```bash
   git clone https://github.com/your-username/vibe-capsule.git
   cd vibe-capsule
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Build**
   ```bash
   npm run build
   ```

4. **Load in Chrome**
   - Open `chrome://extensions/`
   - Enable "Developer mode" (top right)
   - Click "Load unpacked"
   - Select the `dist` folder

## ⚖️ Legal & Disclaimer

**License**: [MIT](LICENSE) © 2026 Kono.

**Disclaimer**: 
This software is provided "as is", without warranty of any kind. VibeCapsule is a client-side tool that interacts with third-party AI services.
- **Data Privacy**: Users are responsible for the content they send to AI providers. Please review the privacy policies of OpenAI, Anthropic, and Google.
- **Costs**: Users are responsible for any API usage fees incurred from their own API keys.
- **Accuracy**: AI-generated summaries may contain errors or hallucinations. Always verify critical information from the source text.

---

*Crafted with ❤️ by Kono*
