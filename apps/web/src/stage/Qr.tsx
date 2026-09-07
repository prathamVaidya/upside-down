import QRCodeStyling from 'qr-code-styling'
import { useEffect, useRef } from 'react'

/**
 * Rounded ink shapes on the stage background, with an untouched quiet zone.
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
    // Reserve the center with a transparent image. The label itself is inline
    // SVG so it can use the page's loaded font, unlike an isolated SVG image.
    const joinLabel = '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="64" />'
    const qr = new QRCodeStyling({
      type: 'svg',
      width: 320,
      height: 320,
      // At least four modules even for the smallest (21-module) QR version.
      margin: 48,
      data: value,
      image: `data:image/svg+xml,${encodeURIComponent(joinLabel)}`,
      imageOptions: { hideBackgroundDots: true, imageSize: 0.3, margin: 4 },
      qrOptions: { errorCorrectionLevel: 'H' },
      dotsOptions: { type: 'rounded', color: ink },
      cornersSquareOptions: { type: 'extra-rounded', color: ink },
      cornersDotOptions: { type: 'dot', color: ink },
      backgroundOptions: { color: 'transparent' },
    })
    qr.applyExtension((svg) => {
      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text')
      text.setAttribute('x', '160')
      text.setAttribute('y', '160')
      text.setAttribute('dy', '0.35em')
      text.setAttribute('text-anchor', 'middle')
      text.setAttribute('font-family', tokens.getPropertyValue('--ud-stage-font').trim())
      text.setAttribute('font-size', '22')
      text.setAttribute('font-weight', '600')
      text.setAttribute('fill', ink)
      text.textContent = 'Join'
      svg.append(text)
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
