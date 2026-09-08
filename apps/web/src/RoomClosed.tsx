import { ClayButton, Wordmark } from '@ud/clay'

export function RoomClosed({ reason, stage = false }: { reason: string; stage?: boolean }) {
  return (
    <div className={stage ? 'stage' : 'phone'} data-testid="room-closed">
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <Wordmark size={stage ? 24 : 18} />
      </div>
      <h1 className={stage ? 'stage__title' : 'phone__title'}>Room closed</h1>
      <p>{reason}</p>
      {stage && (
        <ClayButton
          seed="room-closed-create"
          tone="brick"
          onClick={() => window.location.assign('/stage')}
        >
          Create a new room
        </ClayButton>
      )}
      <ClayButton seed="room-closed-home" tone="sage" onClick={() => window.location.assign('/')}>
        Back to home
      </ClayButton>
    </div>
  )
}
