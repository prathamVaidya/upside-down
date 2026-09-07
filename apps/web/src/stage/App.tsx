import { Doug, Wordmark } from '@ud/clay'
import { useRoom } from '@ud/net'
import { RoomClosed } from '../RoomClosed.tsx'
import { FinaleReveal, FinaleVoting } from './screens/Finale.tsx'
import { Idle } from './screens/Idle.tsx'
import { Reveal } from './screens/Reveal.tsx'
import { Scoreboard } from './screens/Scoreboard.tsx'
import { Voting } from './screens/Voting.tsx'
import { Winner } from './screens/Winner.tsx'
import { Writing } from './screens/Writing.tsx'

/**
 * The television.
 *
 * One idea on screen at a time, and no input of any kind — the host drives
 * everything from their phone, so this never needs a remote control, a cursor,
 * or a smart-TV keyboard.
 */
export function App() {
  const { view, status, mustReload, offsetMs, roomClosed } = useRoom('stage')

  if (roomClosed) return <RoomClosed reason={roomClosed} stage />

  if (mustReload) {
    return (
      <div className="stage">
        <Wordmark size={30} />
        <h1 className="stage__title">The game updated</h1>
        <p className="stage__sub">{mustReload}</p>
      </div>
    )
  }

  if (!view) {
    return (
      <div className="stage">
        <Wordmark size={30} />
        <p className="stage__sub" style={{ marginTop: '4vmin' }}>
          {status === 'dropped' ? 'lost the server. trying again.' : 'warming up the clay'}
        </p>
        <Doug pose="idle" size={90} />
      </div>
    )
  }

  const phase = view.phase

  return (
    <div className="stage" data-testid="stage" data-phase={phase.name} data-round={view.round}>
      {status === 'dropped' && (
        <div
          style={{
            position: 'absolute',
            top: 10,
            left: '50%',
            transform: 'translateX(-50%)',
            fontSize: 13,
            color: 'var(--ud-ink-faint)',
          }}
        >
          reconnecting
        </div>
      )}

      {phase.name === 'lobby' && <Idle view={view} phase={phase} />}
      {phase.name === 'writing' && <Writing view={view} phase={phase} offsetMs={offsetMs} />}
      {phase.name === 'voting' && <Voting view={view} phase={phase} offsetMs={offsetMs} />}
      {phase.name === 'reveal' && <Reveal view={view} phase={phase} />}
      {phase.name === 'finaleVoting' && (
        <FinaleVoting view={view} phase={phase} offsetMs={offsetMs} />
      )}
      {phase.name === 'finaleReveal' && <FinaleReveal view={view} phase={phase} />}
      {phase.name === 'scoreboard' && <Scoreboard view={view} phase={phase} />}
      {phase.name === 'winner' && <Winner view={view} phase={phase} />}
    </div>
  )
}
