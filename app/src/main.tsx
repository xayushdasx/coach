import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles.css'

// The free backend sleeps when idle and takes ~20–50 s to wake. Start waking it now,
// so it's ready by the time someone extracts knowledge or starts a call.
fetch('/api/health').catch(() => {})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
