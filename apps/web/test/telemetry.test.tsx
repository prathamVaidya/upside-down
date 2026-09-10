// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'

const sdk = vi.hoisted(() => ({
  init: vi.fn(),
  opt_in_capturing: vi.fn(),
  opt_out_capturing: vi.fn(),
  stopSessionRecording: vi.fn(),
  startSessionRecording: vi.fn(),
  captureException: vi.fn(),
  __loaded: false,
}))
vi.mock('posthog-js', () => ({ default: sdk }))

afterEach(() => {
  cleanup()
  localStorage.clear()
  vi.unstubAllEnvs()
  vi.clearAllMocks()
  vi.resetModules()
  sdk.__loaded = false
})

it('does not initialize or display diagnostics without configuration', async () => {
  vi.stubEnv('VITE_POSTHOG_KEY', '')
  const { initTelemetry, DiagnosticsConsent } = await import('../src/telemetry.tsx')
  initTelemetry()
  render(<DiagnosticsConsent />)
  expect(sdk.init).not.toHaveBeenCalled()
  expect(screen.queryByText('Privacy & diagnostics')).toBeNull()
})

it('requires consent, masks content, and supports withdrawal', async () => {
  vi.stubEnv('PROD', true)
  vi.stubEnv('VITE_POSTHOG_KEY', 'public-test-key')
  vi.stubEnv('VITE_POSTHOG_HOST', 'https://us.i.posthog.com')
  const { initTelemetry, DiagnosticsConsent } = await import('../src/telemetry.tsx')
  initTelemetry()
  render(<DiagnosticsConsent />)
  expect(sdk.init).not.toHaveBeenCalled()
  fireEvent.click(screen.getByText('Allow diagnostics'))
  await waitFor(() => expect(sdk.init).toHaveBeenCalled())
  expect(sdk.init.mock.calls[0]![1]).toMatchObject({
    autocapture: false,
    enable_recording_console_log: false,
    session_recording: {
      maskAllInputs: true,
      maskTextSelector: '*',
      recordHeaders: false,
      recordBody: false,
    },
  })
  fireEvent.click(screen.getByText('Turn off diagnostics'))
  await waitFor(() => expect(sdk.opt_out_capturing).toHaveBeenCalled())
  expect(sdk.stopSessionRecording).toHaveBeenCalled()
  sdk.__loaded = true
  fireEvent.click(screen.getByText('Allow diagnostics'))
  await waitFor(() => expect(sdk.startSessionRecording).toHaveBeenCalled())
})

it('strips sensitive URL components and room paths', async () => {
  const { safeUrl } = await import('../src/telemetry.tsx')
  expect(safeUrl('https://game.test/r/COMB?token=secret#private')).toBe(
    'https://game.test/r/[room]',
  )
  expect(safeUrl('not a URL')).toBe('')
})

it('redacts exception messages before transmission', async () => {
  const { privacyConfig } = await import('../src/telemetry.tsx')
  const beforeSend = privacyConfig.before_send
  if (typeof beforeSend !== 'function') throw new Error('missing sanitizer')
  const event = {
    event: '$exception',
    properties: {
      $exception_message: 'secret answer',
      $exception_list: [{ type: 'Error', value: 'secret answer', stacktrace: { frames: [] } }],
      $current_url: 'https://game.test/play?token=secret',
    },
  }
  const result = beforeSend(event)
  expect(JSON.stringify(result)).not.toContain('secret')
  expect(result?.properties.$exception_list[0].type).toBe('Error')
  expect(
    privacyConfig.session_recording?.maskAttributeFn?.('aria-label', 'vote for secret answer'),
  ).toBe('[redacted]')
})
