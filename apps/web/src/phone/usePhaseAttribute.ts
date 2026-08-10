import { useEffect } from 'react'

/**
 * Publish the phone's current phase onto `<body>` as `data-phase`.
 *
 * A browser test needs to know when a transition has landed, and polling for
 * copy is brittle — copy is the part of this product most likely to change, and
 * a test that breaks when a joke gets funnier is a bad test.
 *
 * It goes on `<body>` rather than a wrapper element because each phone screen
 * owns its own root: several of them use sticky positioning and `100dvh`, both
 * of which break if you nest them inside another div.
 */
export function usePhaseAttribute(phase: string, status: string): void {
  useEffect(() => {
    document.body.dataset.phase = phase
    document.body.dataset.status = status
    return () => {
      delete document.body.dataset.phase
      delete document.body.dataset.status
    }
  }, [phase, status])
}
