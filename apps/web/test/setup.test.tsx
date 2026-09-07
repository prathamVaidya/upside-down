// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { RoomSetup } from '../src/RoomSetup.tsx'

afterEach(cleanup)

it('shows country flags and a globe on both surfaces', () => {
  for (const onChange of [undefined, vi.fn()]) {
    const { container, unmount } = render(
      <RoomSetup settings={{ region: 'in', level: 2 }} onChange={onChange} />,
    )
    expect(
      [...container.querySelectorAll('.room-setup__flag img')].map((flag) =>
        flag.getAttribute('src')?.split('/').at(-1),
      ),
    ).toEqual(['in.svg?no-inline', 'gb.svg?no-inline', 'us.svg?no-inline'])
    expect(container.querySelectorAll('.room-setup__flag')[3]!.textContent).toBe('🌍')
    unmount()
  }
})

it('sends the new choice while preserving the other setting', () => {
  const onChange = vi.fn()
  render(<RoomSetup settings={{ region: 'in', level: 2 }} onChange={onChange} />)
  expect(screen.getByRole('button', { name: /India/ }).getAttribute('aria-pressed')).toBe('true')
  expect(screen.queryByText('SELECTED')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: /UK/ }))
  expect(onChange).toHaveBeenLastCalledWith('uk', 2)
  const slider = screen.getByRole('slider', { name: 'How dark can it get?' })
  expect(slider.getAttribute('aria-valuetext')).toBe('Medium roast')
  fireEvent.change(slider, { target: { value: '1' } })
  expect(onChange).toHaveBeenLastCalledWith('in', 1)
})

it('shows the same selections on the stage without interactive controls', () => {
  const { container } = render(<RoomSetup settings={{ region: 'us', level: 3 }} />)
  expect(screen.queryByRole('button')).toBeNull()
  expect(screen.queryByRole('slider')).toBeNull()
  const selected = [...container.querySelectorAll('[data-selected="true"]')]
  expect(selected).toHaveLength(2)
  expect(selected[0]!.textContent).toContain('US')
  expect(selected[1]!.textContent).toContain('Meet in Hell together')
})
