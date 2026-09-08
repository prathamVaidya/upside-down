import { expect, it, vi } from 'vitest'
import { StageAudio } from '../src/stage/audio.ts'

function mockAudio() {
  const parameter = () => ({
    value: 0,
    setValueAtTime: vi.fn(),
    linearRampToValueAtTime: vi.fn(),
    exponentialRampToValueAtTime: vi.fn(),
    setTargetAtTime: vi.fn(),
  })
  const sources: ReturnType<typeof node>[] = []
  function node() {
    return {
      connect: vi.fn(function (this: unknown, next: unknown) {
        return next
      }),
      disconnect: vi.fn(),
      gain: parameter(),
      frequency: parameter(),
      start: vi.fn(),
      stop: vi.fn(),
      onended: null,
    }
  }
  const source = () => {
    const n = node()
    sources.push(n)
    return n
  }
  const context = {
    state: 'suspended',
    currentTime: 0,
    sampleRate: 8000,
    destination: node(),
    onstatechange: null,
    createGain: vi.fn(node),
    createOscillator: vi.fn(source),
    createBufferSource: vi.fn(source),
    createBiquadFilter: vi.fn(node),
    createBuffer: (_channels: number, size: number) => ({
      getChannelData: () => new Float32Array(size),
    }),
    resume: vi.fn(async () => {
      context.state = 'running'
    }),
    close: vi.fn(async () => {
      context.state = 'closed'
    }),
  }
  const create = vi.fn(() => context as unknown as AudioContext)
  return { context, sources, create, player: new StageAudio(create) }
}

it('starts silent, never queues missed sounds, and mutes immediately', async () => {
  const { player, create, sources } = mockAudio()
  player.play('winner')
  expect(create).not.toHaveBeenCalled()
  await player.enable()
  expect(sources).toHaveLength(0)
  player.play('winner')
  expect(sources).toHaveLength(5)
  player.mute()
  expect(sources.every((s) => s.stop.mock.calls.length >= 2)).toBe(true)
  player.play('join')
  expect(sources).toHaveLength(5)
  player.dispose()
})

it('coalesces bursts, caps overlap, and prioritizes reveal cues', async () => {
  const { player, sources, context } = mockAudio()
  await player.enable()
  for (let i = 0; i < 20; i++) player.play('vote-land')
  expect(sources).toHaveLength(2)
  for (let i = 0; i < 10; i++) {
    context.currentTime += 0.1
    player.play('submit')
  }
  expect(sources).toHaveLength(6)
  player.play('sweep')
  expect(sources).toHaveLength(11)
  expect(sources[0]!.stop).toHaveBeenCalledTimes(2)
  player.dispose()
})

it('skips suspended and zero-volume cues, and cannot restart after disposal', async () => {
  const { player, sources, context } = mockAudio()
  await player.enable()
  context.state = 'suspended'
  player.play('start')
  context.state = 'running'
  player.setVolume(0)
  player.play('start')
  expect(sources).toHaveLength(0)
  player.setVolume(0.18)
  player.play('start')
  expect(sources).toHaveLength(6)
  player.dispose()
  await player.enable()
  player.play('winner')
  expect(sources).toHaveLength(6)
  expect(context.close).toHaveBeenCalledOnce()
})

it.each([
  ['join', 2],
  ['start', 6],
  ['submit', 2],
  ['vote-land', 2],
  ['flip', 2],
  ['sweep', 5],
  ['round-end', 2],
  ['winner', 5],
] as const)('schedules the approved %s cue', async (cue, sourceCount) => {
  const { player, sources } = mockAudio()
  await player.enable()
  player.play(cue)
  expect(sources).toHaveLength(sourceCount)
  player.dispose()
})
