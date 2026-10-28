# Coach — sales training app

React app served by Vite. The Vite dev server proxies AI calls and adds the API keys, so keys never reach the browser.

- Thinking (prompts P1–P7): Google Gemini `gemini-3.1-flash-lite` (free tier)
- Buyer voice: Sarvam `bulbul:v4-flash`
- Rep's voice → text: Sarvam `saaras:v4`

Put the keys in `app/.env.local` (see `.env.example`):

```
GEMINI_API_KEY=...
SARVAM_API_KEY=...
```

## Run

```bash
npm install
npm run dev
```

Open http://localhost:5173 and use Chrome or Edge with headphones. Settings has buttons to test Gemini and the buyer voice.

## Flow

1. **Company** — form + uploads → **P1 Extractor** (`src/prompts/p1-extractor.ts`)
2. **Sales brief** — **P2 Editorial**, reviewed and approved by the admin; scorecard weights editable
3. **Buyers** — **P3 Persona generator**: lead card + hidden truth + objection script
4. **Lessons & quiz** — **P4**
5. **Practice call** — live voice; **P5 Buyer agent** answers each turn with speech + hidden state (trust, facts revealed, objections)
6. **Report** — measured metrics (`src/lib/metrics.ts`) + **P6 Judge** + **P7 Report writer**; overall score is computed in code from stage weights

Empathy, tone, confidence and conviction are deliberately not scored. Everything scored is either measured or backed by a transcript quote.

Data is stored in the browser's localStorage (`src/lib/store.ts`).
