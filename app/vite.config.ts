import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'

// The dev server proxies AI calls and adds the API keys, so keys never reach the browser.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, fileURLToPath(new URL('.', import.meta.url)), '')
  return {
    plugins: [react()],
    server: {
      port: 5173,
      proxy: {
        '/api/gemini': {
          target: 'https://generativelanguage.googleapis.com',
          changeOrigin: true,
          rewrite: (p) => p.replace(/^\/api\/gemini/, ''),
          headers: { 'x-goog-api-key': env.GEMINI_API_KEY ?? '' },
        },
        '/api/sarvam': {
          target: 'https://api.sarvam.ai',
          changeOrigin: true,
          rewrite: (p) => p.replace(/^\/api\/sarvam/, ''),
          headers: { 'api-subscription-key': env.SARVAM_API_KEY ?? '' },
        },
      },
    },
  }
})
