import '@ud/clay'
import './phone.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { captureReactError, DiagnosticsConsent, initTelemetry } from '../telemetry.tsx'
import { App } from './App.tsx'

initTelemetry()

createRoot(document.getElementById('root')!, {
  onUncaughtError: captureReactError,
  onCaughtError: captureReactError,
}).render(
  <StrictMode>
    <App />
    <DiagnosticsConsent />
  </StrictMode>,
)
