// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, it } from 'vitest'
import { Privacy } from '../src/privacy/Privacy.tsx'

afterEach(cleanup)
it('renders the policy source with navigable sections and provider links', () => {
  render(<Privacy />)
  expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Upside Down privacy policy')
  expect(screen.getByRole('link', { name: 'Your controls' }).getAttribute('href')).toBe(
    '#your-controls',
  )
  expect(screen.getByRole('heading', { name: 'Your controls' }).id).toBe('your-controls')
  expect(screen.getByRole('link', { name: "PostHog's privacy policy" }).getAttribute('href')).toBe(
    'https://posthog.com/privacy',
  )
  expect(screen.getByRole('article').textContent).toContain('without masking')
  expect(screen.getByRole('article').textContent).toContain('90 days')
  expect(screen.getByRole('article').textContent).toContain('Pratham Vaidya')
  expect(
    screen.getByRole('link', { name: 'iamprathamvaidya@gmail.com' }).getAttribute('href'),
  ).toBe('mailto:iamprathamvaidya@gmail.com')
  expect(screen.getByRole('article').textContent).not.toMatch(
    /Publication draft|\[add |before publication/,
  )
})
