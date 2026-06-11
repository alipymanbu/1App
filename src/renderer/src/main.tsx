import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { ErrorBoundary } from './components/ErrorBoundary'
import './styles/globals.css'

window.addEventListener('error', (event) => {
  console.error('[Global Error]', event.error || event.message)
  window.electronApi?.logRenderer({
    level: 'error',
    message: event.error?.message || event.message || 'Unknown error',
    stack: event.error?.stack,
    context: 'global-error'
  })
})

window.addEventListener('unhandledrejection', (event) => {
  console.error('[Unhandled Rejection]', event.reason)
  window.electronApi?.logRenderer({
    level: 'error',
    message: event.reason?.message || String(event.reason || 'Unknown rejection'),
    stack: event.reason?.stack,
    context: 'unhandled-rejection'
  })
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
)
