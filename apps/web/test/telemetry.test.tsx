// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { createRoom, project } from '@ud/engine'
import { RoomClient, type RoomSnapshot } from '@ud/net'
import { afterEach, expect, it, vi } from 'vitest'

const sdk = vi.hoisted(() => ({
  init: vi.fn(),
  opt_in_capturing: vi.fn(),
  opt_out_capturing: vi.fn(),
  stopSessionRecording: vi.fn(),
  startSessionRecording: vi.fn(),
  captureException: vi.fn(),
  register: vi.fn(),
  capture: vi.fn(),
  __loaded: false,
}))
vi.mock('posthog-js', () => ({ default: sdk }))

afterEach(() => {
  cleanup()
  localStorage.clear()
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
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

it('starts by default with no saved preference and supports opting out and back in', async () => {
  vi.stubEnv('PROD', true)
  vi.stubEnv('VITE_POSTHOG_KEY', 'public-test-key')
  vi.stubEnv('VITE_POSTHOG_HOST', 'https://us.i.posthog.com')
  const { initTelemetry, DiagnosticsConsent } = await import('../src/telemetry.tsx')
  initTelemetry()
  render(<DiagnosticsConsent />)
  await waitFor(() => expect(sdk.init).toHaveBeenCalled())
  expect(sdk.init.mock.calls[0]![1]).toMatchObject({
    autocapture: false,
    enable_recording_console_log: false,
    session_recording: {
      maskAllInputs: false,
      maskTextSelector: '',
      recordHeaders: false,
      recordBody: false,
    },
  })
  fireEvent.click(screen.getByText('Turn off diagnostics'))
  await waitFor(() => expect(sdk.opt_out_capturing).toHaveBeenCalled())
  expect(sdk.stopSessionRecording).toHaveBeenCalled()
  sdk.__loaded = true
  fireEvent.click(screen.getByText('Enable diagnostics'))
  await waitFor(() => expect(sdk.startSessionRecording).toHaveBeenCalled())
})

it('records every text/input/attribute value regardless of public markers', async () => {
  const { privacyConfig } = await import('../src/telemetry.tsx')
  const mask = privacyConfig.session_recording!.maskTextFn!
  const visible = document.createElement('span')
  visible.dataset.replayPublic = 'true'
  expect(mask('submitted answer', visible)).toBe('submitted answer')
  visible.dataset.replayPublic = 'false'
  expect(mask('submitted answer', visible)).toBe('submitted answer')
  expect(mask('Player Name', document.createElement('span'))).toBe('Player Name')
  expect(mask('Question?', null)).toBe('Question?')
  expect(privacyConfig.session_recording?.maskAllInputs).toBe(false)
  expect(privacyConfig.session_recording?.maskAllElementAttributes).toBe(false)
  expect(privacyConfig.session_recording?.maskInputOptions?.password).toBe(false)
  expect(
    privacyConfig.session_recording?.maskInputFn?.(
      'unfinished draft',
      document.createElement('textarea'),
    ),
  ).toBe('unfinished draft')
  expect(privacyConfig.session_recording?.maskAttributeFn?.('value', 'draft')).toBe('draft')
  expect(privacyConfig.session_recording?.blockSelector).toBe('')
})

it('links consented replays to server IDs, deduplicates markers, and clears room context on exit', async () => {
  localStorage.setItem('ud.diagnostics.v2', 'no')
  vi.stubEnv('PROD', true)
  vi.stubEnv('VITE_POSTHOG_KEY', 'public-test-key')
  vi.stubEnv('VITE_POSTHOG_HOST', 'https://us.i.posthog.com')
  const { useGameReplay, DiagnosticsConsent } = await import('../src/telemetry.tsx')
  const client = new RoomClient('ws://unused', 'phone')
  const view = project(createRoom('COMB', 100, 1), null, 100)
  view.you = {
    id: 'p1',
    name: 'Private Name',
    color: 'sage',
    shape: 'pebble',
    kind: 'player',
    connected: true,
    isHost: true,
    score: 0,
    delta: 0,
  }
  view.replay = { roomId: 'room-1', gameId: null, submittedAnswersVisible: false }
  let snap: RoomSnapshot = {
    ...client.snapshot(),
    status: 'open',
    view,
    seatId: 'p1',
    code: 'COMB',
  }
  vi.spyOn(client, 'snapshot').mockImplementation(() => snap)
  let update = () => {}
  vi.spyOn(client, 'subscribe').mockImplementation((fn) => {
    update = fn
    return () => {}
  })
  const send = vi.spyOn(client, 'send').mockImplementation(() => {})
  function Bound() {
    useGameReplay(client, 'phone')
    return <DiagnosticsConsent />
  }
  render(<Bound />)
  expect(sdk.capture).not.toHaveBeenCalled()
  expect(send).toHaveBeenLastCalledWith({ t: 'diagnostics.set', submittedAnswers: false })
  fireEvent.click(screen.getByText('Enable diagnostics'))
  await waitFor(() => expect(sdk.init).toHaveBeenCalled())
  sdk.__loaded = true
  sdk.init.mock.calls[0]![1].loaded(sdk)
  expect(send).toHaveBeenLastCalledWith({ t: 'diagnostics.set', submittedAnswers: true })
  expect(sdk.capture).toHaveBeenCalledWith(
    'game.replay_context',
    expect.objectContaining({
      room_id: 'room-1',
      room_code: 'COMB',
      player_id: 'p1',
      app_surface: 'phone',
    }),
  )
  snap = { ...snap, view: { ...view, round: 1, replay: { ...view.replay, gameId: 'game-1' } } }
  update()
  await waitFor(() =>
    expect(sdk.capture).toHaveBeenCalledWith(
      'game.replay_context',
      expect.objectContaining({ game_id: 'game-1', round: 1 }),
    ),
  )
  const count = sdk.capture.mock.calls.length
  update()
  await Promise.resolve()
  expect(sdk.capture).toHaveBeenCalledTimes(count)
  snap = { ...snap, status: 'dropped' }
  update()
  snap = { ...snap, status: 'open' }
  update()
  expect(send).toHaveBeenLastCalledWith({ t: 'diagnostics.set', submittedAnswers: true })
  snap = { ...snap, view: null, code: null, seatId: null }
  update()
  await waitFor(() =>
    expect(sdk.register).toHaveBeenLastCalledWith(
      expect.objectContaining({ room_id: null, game_id: null, player_id: null, room_code: null }),
    ),
  )
  expect(JSON.stringify(sdk.capture.mock.calls)).not.toContain('Private Name')
  fireEvent.click(screen.getByText('Turn off diagnostics'))
  await waitFor(() => expect(sdk.stopSessionRecording).toHaveBeenCalled())
})

it.each(['ud.diagnostics', 'ud.diagnostics.v2'])(
  'preserves an explicit opt-out in %s',
  async (key) => {
    vi.stubEnv('PROD', true)
    vi.stubEnv('VITE_POSTHOG_KEY', 'public-test-key')
    vi.stubEnv('VITE_POSTHOG_HOST', 'https://us.i.posthog.com')
    localStorage.setItem(key, 'no')
    const { initTelemetry, DiagnosticsConsent } = await import('../src/telemetry.tsx')
    initTelemetry()
    render(<DiagnosticsConsent />)
    await Promise.resolve()
    expect(sdk.init).not.toHaveBeenCalled()
    expect(screen.getByText('Enable diagnostics')).toBeTruthy()
  },
)

it('does not record in development or when preference storage is unavailable', async () => {
  vi.stubEnv('PROD', false)
  vi.stubEnv('VITE_POSTHOG_KEY', 'public-test-key')
  vi.stubEnv('VITE_POSTHOG_HOST', 'https://us.i.posthog.com')
  const dev = await import('../src/telemetry.tsx')
  dev.initTelemetry()
  await Promise.resolve()
  expect(sdk.init).not.toHaveBeenCalled()
  vi.resetModules()
  vi.stubEnv('PROD', true)
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
    throw new Error('blocked')
  })
  const prod = await import('../src/telemetry.tsx')
  prod.initTelemetry()
  await Promise.resolve()
  expect(sdk.init).not.toHaveBeenCalled()
})

it('honors Do Not Track and withdrawal from another tab', async () => {
  vi.stubEnv('PROD', true)
  vi.stubEnv('VITE_POSTHOG_KEY', 'public-test-key')
  vi.stubEnv('VITE_POSTHOG_HOST', 'https://us.i.posthog.com')
  const { initTelemetry, DiagnosticsConsent } = await import('../src/telemetry.tsx')
  localStorage.setItem('ud.diagnostics.v2', 'yes')
  vi.stubGlobal('navigator', Object.create(navigator, { doNotTrack: { value: '1' } }))
  initTelemetry()
  expect(sdk.init).not.toHaveBeenCalled()
  vi.unstubAllGlobals()
  render(<DiagnosticsConsent />)
  initTelemetry()
  await waitFor(() => expect(sdk.init).toHaveBeenCalled())
  localStorage.setItem('ud.diagnostics.v2', 'no')
  window.dispatchEvent(new StorageEvent('storage', { key: 'ud.diagnostics.v2', newValue: 'no' }))
  await waitFor(() => expect(sdk.stopSessionRecording).toHaveBeenCalled())
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
  ).toBe('vote for secret answer')
})
