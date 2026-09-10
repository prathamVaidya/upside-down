import { Doug, Wordmark } from '@ud/clay'
import { createRoot } from 'react-dom/client'
import './landing.css'
import { captureReactError, DiagnosticsConsent, initTelemetry } from '../telemetry.tsx'

initTelemetry()

function Landing() {
  return (
    <main className="landing">
      <header className="landing__header">
        <Wordmark size={22} />
        <a href="/play" data-testid="join-room">
          Join a room
        </a>
      </header>
      <section className="landing__hero" aria-labelledby="headline">
        <div className="landing__copy">
          <h1 id="headline">
            Bad answers.
            <br />
            Good company.
          </h1>
          <p>The dumb game to play with your degen friends</p>
          <a
            className="landing__cta ud-clay ud-clay--sage"
            href="/stage?new=1"
            data-testid="create-room"
          >
            Create a room
          </a>
          <p className="landing__note">
            Open the room on a big screen. Everyone joins on their phone.
          </p>
        </div>
        <div className="landing__mascot" aria-hidden="true">
          <Doug pose="idle" size={210} />
          <p>your dignity is optional.</p>
        </div>
      </section>
      <footer className="landing__footer">
        <p>3–8 players. About 15 minutes.</p>
        <p>Free to play. No downloads. No accounts.</p>
        <a href="https://github.com/prathamVaidya/upside-down">View on GitHub</a>
        <a href="/privacy">Privacy policy</a>
      </footer>
    </main>
  )
}

createRoot(document.getElementById('root')!, {
  onUncaughtError: captureReactError,
  onCaughtError: captureReactError,
}).render(
  <>
    <Landing />
    <DiagnosticsConsent />
  </>,
)
