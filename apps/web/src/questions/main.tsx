import '@ud/clay'
import { createRoot } from 'react-dom/client'
import { captureReactError, DiagnosticsConsent, initTelemetry } from '../telemetry.tsx'
import { Questions } from './Questions.tsx'

initTelemetry()
createRoot(document.getElementById('root')!, {
  onUncaughtError: captureReactError,
  onCaughtError: captureReactError,
}).render(
  <>
    <Questions />
    <DiagnosticsConsent />
  </>,
)
