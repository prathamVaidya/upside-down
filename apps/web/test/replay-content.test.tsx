// @vitest-environment jsdom
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import { type eventWithTime, record } from 'posthog-js/rrweb'
import { afterEach, expect, it } from 'vitest'
import { privacyConfig } from '../src/telemetry.tsx'

afterEach(cleanup)

it('preserves UI, questions, answers and drafts in actual recorder snapshots', async () => {
  const { getByLabelText } = render(
    <div>
      <h1>Waiting screen heading</h1>
      <p data-replay-public="true">Readable question?</p>
      <p data-replay-public="false">Readable submitted answer</p>
      <span className="ph-mask">Readable player name</span>
      <textarea aria-label="draft" defaultValue="Unfinished draft" />
      <input aria-label="nickname" defaultValue="Test nickname" />
      <input aria-label="password test" type="password" defaultValue="Synthetic password" />
    </div>,
  )
  const events: eventWithTime[] = []
  const stop = record({ ...privacyConfig.session_recording, emit: (e) => events.push(e) })
  try {
    await waitFor(() => expect(events.some((e) => e.type === 2)).toBe(true))
    const snapshot = JSON.stringify(events.filter((e) => e.type === 2))
    for (const text of [
      'Waiting screen heading',
      'Readable question?',
      'Readable submitted answer',
      'Readable player name',
      'Unfinished draft',
      'Test nickname',
      'Synthetic password',
    ]) {
      expect(snapshot).toContain(text)
    }
    fireEvent.input(getByLabelText('draft'), { target: { value: 'Edited draft still readable' } })
    await waitFor(() =>
      expect(JSON.stringify(events.filter((e) => e.type === 3))).toContain(
        'Edited draft still readable',
      ),
    )
  } finally {
    stop?.()
  }
})
