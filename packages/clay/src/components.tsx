import type { ColorRole, ShapeId } from '@ud/protocol'
import type { ButtonHTMLAttributes, CSSProperties, HTMLAttributes, ReactNode } from 'react'
import type { ClayShapeOptions } from './shape.ts'
import { useClayShape } from './shape.ts'

export type Tone = ColorRole | 'card' | 'ink'

const toneClass: Record<Tone, string> = {
  brick: 'ud-clay--brick',
  slate: 'ud-clay--slate',
  butter: 'ud-clay--butter',
  sage: 'ud-clay--sage',
  card: 'ud-clay--card',
  ink: 'ud-clay--ink',
}

type ClayProps = HTMLAttributes<HTMLDivElement> & {
  tone?: Tone
  seed: string | number
  shape?: ClayShapeOptions
  children?: ReactNode
}

/** A lump of clay sitting on the table. Everything visible is one of these. */
export function Clay({ tone = 'card', seed, shape, className = '', style, ...rest }: ClayProps) {
  const shapeStyle = useClayShape(seed, shape)
  return (
    <div
      className={`ud-clay ${toneClass[tone]} ${className}`}
      style={{ ...shapeStyle, ...style }}
      {...rest}
    />
  )
}

type ClayButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  tone?: Tone
  seed: string | number
  shape?: ClayShapeOptions
}

/**
 * The phone is a remote control, so this is most of its interface: one huge
 * target that deforms under the thumb.
 */
export function ClayButton({
  tone = 'brick',
  seed,
  shape,
  className = '',
  style,
  ...rest
}: ClayButtonProps) {
  const shapeStyle = useClayShape(seed, shape)
  return (
    <button
      type="button"
      className={`ud-clay ud-press ${toneClass[tone]} ${className}`}
      style={{
        ...shapeStyle,
        font: '600 21px var(--ud-stage-font)',
        padding: '20px 24px',
        ...style,
      }}
      {...rest}
    />
  )
}

/**
 * A seat's silhouette. Four palette colours cover eight players, so the shape
 * carries the rest of the identity — which also keeps meaning off colour alone.
 */
export function Blob({
  color,
  shape,
  size = 34,
  upsideDown = false,
  className = '',
  style,
}: {
  color: ColorRole
  shape: ShapeId
  size?: number
  upsideDown?: boolean
  className?: string
  style?: CSSProperties
}) {
  return (
    <div
      className={`ud-blob ${shape === 'lump' ? 'ud-blob--lump' : ''} ${className}`}
      style={{
        width: size,
        height: size * 0.88,
        background: `var(--ud-${color})`,
        flex: 'none',
        transform: upsideDown ? 'rotate(180deg)' : undefined,
        ...style,
      }}
    />
  )
}

/** A vote. It travels and lands; it is never a number that increments. */
export function Pellet({ color, index = 0 }: { color: ColorRole; index?: number }) {
  return (
    <div
      className="ud-blob ud-anim-pellet"
      style={{
        width: 18,
        height: 16,
        background: `var(--ud-${color})`,
        animationDelay: `${index * 90}ms`,
      }}
    />
  )
}

const LETTERS = [
  { ch: 'U', tone: 'brick' },
  { ch: 'P', tone: 'sage' },
  { ch: 'S', tone: 'slate' },
  { ch: 'I', tone: 'butter' },
  { ch: 'D', tone: 'brick' },
  { ch: 'E', tone: 'sage' },
] as const

/**
 * The wordmark: each letter its own pellet, and DOWN is the same tiles dropped.
 * The name has to feel earned by the interface rather than printed on it.
 */
export function Wordmark({ size = 24 }: { size?: number }) {
  const tile = (ch: string, tone: Tone, key: string, flipped: boolean) => (
    <Clay
      key={key}
      seed={`wordmark-${key}`}
      tone={tone}
      shape={{ radius: size * 0.34, jitter: size * 0.08, tilt: 4 }}
      style={{
        width: size,
        height: size * 1.2,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        font: `600 ${Math.round(size * 0.66)}px var(--ud-stage-font)`,
        ...(flipped ? { transform: 'rotate(180deg)' } : {}),
      }}
    >
      {ch}
    </Clay>
  )

  return (
    <div style={{ display: 'flex', gap: size * 0.16, alignItems: 'center' }}>
      <span className="ud-sr-only">Upside Down</span>
      {LETTERS.map((l, i) => tile(l.ch, l.tone, `up-${i}`, false))}
      <div style={{ width: size * 0.3 }} />
      {['D', 'O', 'W', 'N'].map((ch, i) => tile(ch, 'ink', `down-${i}`, true))}
    </div>
  )
}

export type DougPose = 'idle' | 'watching' | 'shocked' | 'delighted' | 'upsidedown'

/**
 * Doug.
 *
 * A small set of poses rather than a rigged character — cheapest
 * personality-per-unit-of-effort in the whole product, and made of exactly the
 * same clay as everything else, so he costs no assets.
 */
export function Doug({ pose = 'idle', size = 104 }: { pose?: DougPose; size?: number }) {
  const eye = (side: 'left' | 'right') => (
    <div
      style={{
        position: 'absolute',
        top: size * 0.19,
        [side]: size * 0.18,
        width: size * 0.25,
        height: size * 0.28,
        background: 'var(--ud-card)',
        borderRadius: '50%',
      }}
    >
      <div
        className={pose === 'watching' ? 'ud-anim-look' : ''}
        style={{
          position: 'absolute',
          top: '32%',
          left: pose === 'shocked' ? '18%' : '22%',
          width: pose === 'shocked' ? '58%' : '42%',
          height: pose === 'shocked' ? '58%' : '44%',
          background: 'var(--ud-ink)',
          borderRadius: '50%',
        }}
      />
    </div>
  )

  const mouth =
    pose === 'delighted' || pose === 'shocked' ? (
      <div
        style={{
          position: 'absolute',
          bottom: size * 0.16,
          left: '50%',
          transform: 'translateX(-50%)',
          width: size * (pose === 'shocked' ? 0.17 : 0.26),
          height: size * (pose === 'shocked' ? 0.19 : 0.13),
          background: '#8f3f2c',
          borderRadius: pose === 'shocked' ? '50%' : '0 0 14px 14px',
        }}
      />
    ) : (
      <div
        style={{
          position: 'absolute',
          bottom: size * 0.2,
          left: '50%',
          transform: 'translateX(-50%)',
          width: size * 0.16,
          height: size * 0.07,
          background: '#b0673f',
          borderRadius: '0 0 10px 10px',
        }}
      />
    )

  return (
    <div
      className={pose === 'upsidedown' ? '' : 'ud-anim-bob'}
      style={pose === 'upsidedown' ? { transform: 'rotate(180deg)' } : undefined}
    >
      <div
        style={{
          position: 'relative',
          width: size,
          height: size * 0.87,
          background: 'var(--ud-butter)',
          borderRadius: '46% 54% 50% 50% / 62% 58% 42% 38%',
          boxShadow:
            'inset 0 5px 0 rgba(255,255,255,.4), inset 0 -8px 0 rgba(64,53,44,.12), var(--ud-lift)',
        }}
      >
        {eye('left')}
        {eye('right')}
        {mouth}
      </div>
    </div>
  )
}
