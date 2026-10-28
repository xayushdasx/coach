# Coach

AI sales coach: a company describes how it sells, the coach writes a sales brief, generates AI buyers, and reps practise live voice calls and get a scored report.

- `app/` — React frontend (Vite). Deployed on Vercel. See [app/README.md](app/README.md).
- `server/` — small Node backend that holds the Gemini and Sarvam API keys and forwards only the app's AI calls. Deployed on Render.
- `sales-coach-spec.md` — design spec: sales lifecycle, what gets scored, prompt pipeline P1–P7.

## Local development

```bash
cd app
npm install
npm run dev
```

Put `GEMINI_API_KEY` and `SARVAM_API_KEY` in `app/.env.local`. The Vite dev server proxies `/api/*` and adds the keys.

## Deployment

- **Backend (Render):** `render.yaml` defines the `coach-api` web service from `server/` (live at https://coach-api-jar5.onrender.com). Set `GEMINI_API_KEY` and `SARVAM_API_KEY` in the Render dashboard.
- **Frontend (Vercel):** live at https://coach-six-tau.vercel.app; project root `app/`. `app/vercel.json` rewrites `/api/*` to the Render service, so the browser never sees the keys.
