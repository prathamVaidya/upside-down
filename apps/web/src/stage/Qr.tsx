import QRCodeStyling from 'qr-code-styling'
import { useEffect, useRef } from 'react'

/**
 * Rounded clay shapes, with ink-on-card contrast and an untouched quiet zone.
 * The encoder lives in the stage bundle; phones never download it.
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
  const container = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const element = container.current
    if (!element) return
    const tokens = getComputedStyle(element)
    const ink = tokens.getPropertyValue('--ud-ink').trim()
    const card = tokens.getPropertyValue('--ud-card').trim()
    const qr = new QRCodeStyling({
      type: 'svg',
      width: 320,
      height: 320,
      // At least four modules even for the smallest (21-module) QR version.
      margin: 48,
      data: value,
      qrOptions: { errorCorrectionLevel: 'Q' },
      dotsOptions: { type: 'rounded', color: ink },
      cornersSquareOptions: { type: 'extra-rounded', color: ink },
      cornersDotOptions: { type: 'dot', color: ink },
      backgroundOptions: { color: card },
    })
    qr.append(element)
    return () => element.replaceChildren()
  }, [value])

  return (
    <div
      ref={container}
      className="join__symbol"
      data-testid="room-qr"
      style={{ width: size, height: size }}
      role="img"
      aria-label={label ?? `QR code for ${value}`}
    />
  )
}
