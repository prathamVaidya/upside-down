import type { SoundCue } from '@ud/protocol'

/** Approved preview palette. No downloads and no audio before a stage-local gesture. */
export class StageAudio {
  private context: AudioContext | null = null
  private master: GainNode | null = null
  private sources = new Set<AudioScheduledSourceNode>()
  private muted = true
  private disposed = false
  private volume = 0.18
  private lastSmallCue = -Infinity

  constructor(private createContext = () => new AudioContext()) {}

  async enable(): Promise<void> {
    if (this.disposed) return
    if (!this.context) {
      this.context = this.createContext()
      this.master = this.context.createGain()
      this.master.gain.value = this.volume
      this.master.connect(this.context.destination)
      // Stop queued notes when a browser suspends audio; never replay them on resume.
      this.context.onstatechange = () => {
        if (this.context?.state !== 'running') this.stop()
      }
    }
    await this.context.resume()
    if (!this.disposed) this.muted = false
  }

  mute(): void {
    this.muted = true
    this.stop()
  }

  setVolume(value: number): void {
    this.volume = Number.isFinite(value) ? Math.max(0, Math.min(0.5, value)) : 0.18
    if (this.master && this.context) {
      this.master.gain.setTargetAtTime(this.volume, this.context.currentTime, 0.01)
    }
    if (this.volume === 0) this.stop()
  }

  stop(): void {
    for (const source of this.sources) {
      try {
        source.stop()
      } catch {
        /* Already ended. */
      }
    }
    this.sources.clear()
  }

  dispose(): void {
    this.disposed = true
    this.mute()
    if (this.context) {
      this.context.onstatechange = null
      void this.context.close().catch(() => {})
    }
  }

  private track(source: AudioScheduledSourceNode, nodes: AudioNode[]): void {
    this.sources.add(source)
    source.onended = () => {
      this.sources.delete(source)
      source.disconnect()
      for (const node of nodes) node.disconnect()
    }
  }

  private note(
    at: number,
    frequency: number,
    endFrequency: number,
    duration: number,
    amplitude = 0.5,
    type: OscillatorType = 'sine',
  ): void {
    const context = this.context!
    const oscillator = context.createOscillator()
    const envelope = context.createGain()
    oscillator.type = type
    oscillator.frequency.setValueAtTime(frequency, at)
    oscillator.frequency.exponentialRampToValueAtTime(endFrequency, at + duration)
    envelope.gain.setValueAtTime(0, at)
    envelope.gain.linearRampToValueAtTime(amplitude, at + 0.006)
    envelope.gain.exponentialRampToValueAtTime(0.0001, at + duration)
    oscillator.connect(envelope).connect(this.master!)
    this.track(oscillator, [envelope])
    oscillator.start(at)
    oscillator.stop(at + duration + 0.02)
  }

  private rustle(at: number, duration: number, amplitude = 0.2): void {
    const context = this.context!
    const buffer = context.createBuffer(
      1,
      Math.ceil(context.sampleRate * duration),
      context.sampleRate,
    )
    const data = buffer.getChannelData(0)
    let seed = 42
    for (let i = 0; i < data.length; i++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) | 0
      const envelope = Math.min(1, i / (context.sampleRate * 0.005)) * (1 - i / data.length) ** 2
      data[i] = ((seed >>> 0) / 2147483648 - 1) * envelope
    }
    const source = context.createBufferSource()
    const filter = context.createBiquadFilter()
    const gain = context.createGain()
    filter.type = 'lowpass'
    filter.frequency.value = 1800
    gain.gain.value = amplitude
    source.buffer = buffer
    source.connect(filter).connect(gain).connect(this.master!)
    this.track(source, [filter, gain])
    source.start(at)
  }

  play(cue: SoundCue): void {
    const context = this.context
    if (this.disposed || this.muted || !context || context.state !== 'running' || this.volume === 0)
      return
    const small = cue === 'join' || cue === 'submit' || cue === 'vote-land'
    // Coalesce vote/submission bursts and cap simultaneous sources. Major cues take priority.
    if (small) {
      if (context.currentTime - this.lastSmallCue < 0.08 || this.sources.size >= 6) return
      this.lastSmallCue = context.currentTime
    } else this.stop()
    const t = context.currentTime + 0.015
    switch (cue) {
      case 'join':
        this.note(t, 620, 230, 0.14)
        this.rustle(t, 0.035, 0.12)
        break
      case 'start':
        ;[260, 330, 440].forEach((f, i) => {
          this.note(t + i * 0.17, f, f * 0.75, 0.16, 0.45, 'triangle')
          this.rustle(t + i * 0.17, 0.03, 0.1)
        })
        break
      case 'submit':
        this.note(t, 240, 150, 0.08, 0.25)
        this.rustle(t, 0.028, 0.1)
        break
      case 'vote-land':
        this.note(t, 780, 340, 0.045, 0.16)
        this.rustle(t, 0.02, 0.08)
        break
      case 'flip':
        this.rustle(t, 0.14, 0.5)
        this.note(t + 0.12, 180, 75, 0.13, 0.45)
        break
      case 'sweep':
        ;[230, 350, 520].forEach((f, i) => {
          this.note(t + i * 0.1, f, f * 1.3, 0.18, 0.4, 'triangle')
        })
        this.note(t + 0.36, 200, 65, 0.25, 0.65)
        this.rustle(t + 0.36, 0.08, 0.3)
        break
      case 'round-end':
        this.note(t, 392, 385, 0.25, 0.4, 'triangle')
        this.note(t + 0.27, 262, 250, 0.38, 0.4, 'triangle')
        break
      case 'winner':
        ;[262, 330, 392, 523].forEach((f, i) => {
          this.note(t + i * 0.18, f, f * 0.99, 0.32, 0.36, 'triangle')
        })
        this.note(t + 0.94, 220, 75, 0.22, 0.5)
        break
    }
  }
}
