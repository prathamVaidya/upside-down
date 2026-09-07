import '@ud/clay'
import './stage.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App.tsx'

// An explicit create action starts fresh; ordinary stage reloads keep the room.
const entryUrl = new URL(window.location.href)
if (entryUrl.searchParams.get('new') === '1') {
  try {
    localStorage.removeItem('ud.code')
  } catch {
    // Storage may be disabled; in that case there is no saved room to clear.
  }
  entryUrl.searchParams.delete('new')
  window.history.replaceState(null, '', entryUrl)
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
