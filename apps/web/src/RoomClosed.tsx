import { ClayButton, Wordmark } from '@ud/clay'

export function RoomClosed({ reason, stage = false }: { reason: string; stage?: boolean }) {
  return (
    <div className={stage ? 'stage' : 'phone'} data-testid="room-closed">
      <Wordmark size={24} />
      <h1 className={stage ? 'stage__title' : 'phone__title'}>Room closed</h1>
      <p>{reason}</p>
      <ClayButton seed="room-closed-home" tone="sage" onClick={() => window.location.assign('/')}>
        Back to home
      </ClayButton>
    </div>
  )
}
