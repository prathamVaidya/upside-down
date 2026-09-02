import qrcode from 'qrcode-generator'
import { useMemo } from 'react'

/**
 * A QR code, drawn as one SVG path.
 *
 * Deliberately not clay. Every other surface in here is wobbled, tilted and
 * rounded, and a QR code is the one thing on the television that a machine has
 * to read rather than a person — so the modules stay hard-edged squares at full
 * contrast. It sits on a clay plate instead, which is where the house style
 * gets to show up without costing anyone a scan.
 */
export function Qr({
  value,
  size = 180,
  label,
}: {
  value: string
  size?: number | string
  label?: string
}) {
  const { d, extent } = useMemo(() => build(value), [value])

  return (
    <svg
      viewBox={`0 0 ${extent} ${extent}`}
      style={{ width: size, height: size, display: 'block', borderRadius: 6 }}
      role="img"
      aria-label={label ?? `QR code for ${value}`}
      shapeRendering="crispEdges"
    >
      <rect width={extent} height={extent} fill="#fff" />
      <path d={d} fill="#000" />
    </svg>
  )
}

/**
 * The four-module quiet zone is not decoration — scanners key off it to find
 * the symbol, and a QR butted against the edge of its container reads slowly or
 * not at all.
 */
const QUIET = 4

function build(value: string): { d: string; extent: number } {
  // 0 picks the smallest version the data fits in; 'M' is the standard 15%
  // error correction, which is plenty for a short URL on a lit screen.
  const qr = qrcode(0, 'M')
  qr.addData(value)
  qr.make()

  const count = qr.getModuleCount()
  let d = ''
  for (let row = 0; row < count; row++) {
    for (let col = 0; col < count; col++) {
      if (qr.isDark(row, col)) d += `M${col + QUIET} ${row + QUIET}h1v1h-1z`
    }
  }

  return { d, extent: count + QUIET * 2 }
}
