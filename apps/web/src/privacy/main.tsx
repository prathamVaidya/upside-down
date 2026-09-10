import '@ud/clay'
import { createRoot } from 'react-dom/client'
import { captureReactError, DiagnosticsConsent, initTelemetry } from '../telemetry.tsx'
import { Privacy } from './Privacy.tsx'

initTelemetry()
createRoot(document.getElementById('root')!, {
  onUncaughtError: captureReactError,
  onCaughtError: captureReactError,
}).render(
  <>
    <Privacy />
    <DiagnosticsConsent />
  </>,
)
