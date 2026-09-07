import { ClayButton, Wordmark } from '@ud/clay'
import { useRoom } from '@ud/net'
import type { ClientView, Side } from '@ud/protocol'
import { RoomClosed } from '../RoomClosed.tsx'
import { Dropped } from './screens/Dropped.tsx'
import { FinaleVote } from './screens/FinaleVote.tsx'
import { Join } from './screens/Join.tsx'
import { Lobby } from './screens/Lobby.tsx'
import { Vote } from './screens/Vote.tsx'
import { Waiting } from './screens/Waiting.tsx'
import { Write } from './screens/Write.tsx'
import { usePhaseAttribute } from './usePhaseAttribute.ts'

/** `/r/GRUB` is what the idle screen's QR code points at. */
function codeFromPath(): string {
  const m = window.location.pathname.match(/^\/r\/([A-Za-z]{4})/)
  return m ? m[1]!.toUpperCase() : ''
}

export function App() {
  const { view, status, error, offsetMs, mustReload, roomClosed, client, seatId } = useRoom('phone')

  // Mirrored onto <body> rather than a wrapper div, because each phone screen
  // owns its own root element and a wrapper would break the sticky layouts.
  usePhaseAttribute(view && seatId && view.you ? view.phase.name : 'join', status)

  if (roomClosed) return <RoomClosed reason={roomClosed} />

  if (mustReload) {
    return (
      <div className="phone">
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 8 }}>
          <Wordmark size={18} />
        </div>
        <div className="phone__spacer" />
        <h1 className="phone__title" style={{ textAlign: 'center' }}>
          The game updated
        </h1>
        <p className="phone__label" style={{ textAlign: 'center' }}>
          {mustReload}
        </p>
        <div className="phone__spacer" />
        <ClayButton seed="reload" tone="brick" onClick={() => window.location.reload()}>
          reload
        </ClayButton>
      </div>
    )
  }

  // No seat yet — either a fresh arrival, or a code the server did not know.
  if (!view || !seatId || !view.you) {
    return (
      <Join
        initialCode={codeFromPath()}
        error={error}
        onJoin={(code, name) => client.join(code, name)}
      />
    )
  }

  // The socket went away mid-game. It is already retrying underneath this.
  if (status === 'dropped') {
    return <Dropped onRejoin={() => window.location.reload()} />
  }

  const phase = view.phase
  const you = view.you

  return (
    <>
      {renderPhase(view)}
      {you.isHost && (
        <div style={{ maxWidth: 420, margin: '0 auto', padding: '12px 24px 24px' }}>
          <ClayButton
            seed="destroy-room"
            tone="brick"
            data-testid="destroy-room"
            disabled={status !== 'open'}
            onClick={() => {
              if (
                window.confirm(
                  'Destroy this room? This ends the game for everyone and cannot be undone.',
                )
              ) {
                client.send({ t: 'room.destroy' })
              }
            }}
          >
            Destroy room
          </ClayButton>
        </div>
      )}
    </>
  )

  function renderPhase(view: ClientView) {
    switch (phase.name) {
      case 'lobby':
        return (
          <Lobby
            view={view}
            phase={phase}
            onStart={() => client.send({ t: 'game.start' })}
            onSettingsOpen={(open) => client.send({ t: 'settings.open', open })}
            onSettingsChange={(region, level) => client.send({ t: 'settings.set', region, level })}
          />
        )

      case 'writing':
        return phase.assignment ? (
          <Write
            view={view}
            phase={phase}
            offsetMs={offsetMs}
            onSubmit={(slot, text) => client.send({ t: 'answer.submit', slot, text })}
          />
        ) : (
          <Waiting
            view={view}
            line={you.kind === 'audience' ? "You're the audience" : 'Both in'}
            sub={
              you.kind === 'audience'
                ? 'you vote, you judge, you never risk anything. the safest job in comedy.'
                : "good ones? we'll find out together, in public."
            }
          />
        )

      case 'voting':
        return (
          <Vote
            view={view}
            phase={phase}
            offsetMs={offsetMs}
            onVote={(side: Side) => client.send({ t: 'vote.cast', side })}
          />
        )

      case 'finaleVoting':
        return (
          <FinaleVote
            view={view}
            phase={phase}
            offsetMs={offsetMs}
            onVote={(entrySeatId, delta) => client.send({ t: 'finale.vote', entrySeatId, delta })}
          />
        )

      case 'reveal':
      case 'finaleReveal':
        return <Waiting view={view} line="Look up" sub="this is the good bit" />

      case 'scoreboard':
        return (
          <Waiting
            view={view}
            line={`${you.score} points`}
            sub={you.delta > 0 ? `you gained ${you.delta} that round` : 'you gained nothing. bold.'}
          />
        )

      case 'winner':
        return (
          <Waiting
            view={view}
            line={`${you.score} points`}
            sub="the television has the verdict. it is not kind."
          />
        )
    }
  }
}
