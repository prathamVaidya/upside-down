// @vitest-environment jsdom
/**
 * Does the app actually mount?
 *
 * The screen tests render individual screens with hand-fed props, which proves
 * they draw but not that `App` boots — a crash in `useRoom`, a bad import, or a
 * hook rule violation would leave a blank page that every screen test still
 * passes through. There is no server here on purpose: an unreachable socket is
 * the state a real client starts in, and it must render the waiting screen
 * rather than nothing.
 */
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { App } from '../src/stage/App.tsx'

describe('stage boot', () => {
  afterEach(() => {
    // Vitest globals are disabled, so Testing Library cannot register auto-cleanup.
    // Unmount before jsdom teardown to close the socket and cancel its timers.
    cleanup()
    localStorage.clear()
    sessionStorage.clear()
  })

  it('mounts and shows something before the socket connects', async () => {
    const { container } = render(<App />)
    await waitFor(() => expect(container.textContent?.trim().length ?? 0).toBeGreaterThan(0))
    expect(screen.getByText(/warming up the clay|lost the server/)).toBeTruthy()
    // The wordmark is always present, so a blank cream page is never correct.
    expect(screen.getByText('Upside Down')).toBeTruthy()
  })
})
