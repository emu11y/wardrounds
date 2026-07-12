import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/globals.css'
import App from './App.jsx'
import { AuthProvider } from './context/AuthContext'
import { PwaInstallProvider } from './context/PwaInstallContext'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthProvider>
      <PwaInstallProvider>
        <App />
      </PwaInstallProvider>
    </AuthProvider>
  </StrictMode>,
)

// Register the service worker — required for Chrome/Android to consider the app
// installable (and to fire `beforeinstallprompt`). Registered after load so it
// never competes with first paint.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      /* SW registration failing must never break the app */
    })
  })
}
