import { Clay, ClayButton } from '@ud/clay'
import type { ContentLevel, LobbyView, Region } from '@ud/protocol'
import ukFlag from 'flag-icons/flags/4x3/gb.svg?no-inline'
// Import individual assets, never the package entry point (the full flag stylesheet).
import indiaFlag from 'flag-icons/flags/4x3/in.svg?no-inline'
import usFlag from 'flag-icons/flags/4x3/us.svg?no-inline'
import type { CSSProperties } from 'react'
import './room-setup.css'

export const REGIONS = [
  { value: 'in', label: 'India', flag: indiaFlag, hint: 'Government, Auto, Shaadi' },
  { value: 'uk', label: 'UK', flag: ukFlag, hint: 'Queues, weather, passive aggression' },
  { value: 'us', label: 'US', flag: usFlag, hint: 'Tipping, HOAs, portion sizes' },
  { value: 'global', label: 'Global', flag: null, hint: 'Jokes that work everywhere. Allegedly.' },
] as const

export const LEVELS = [
  { value: 1, label: 'HR approved', hint: 'Keep it office-safe', tone: 'sage' },
  { value: 2, label: 'Medium roast', hint: 'A little less employable', tone: 'butter' },
  { value: 3, label: 'Meet in Hell together', hint: 'You picked your audience', tone: 'brick' },
] as const

export function settingsLabel(settings: LobbyView['settings']): string {
  return `${REGIONS.find((r) => r.value === settings.region)!.label} · ${LEVELS.find((l) => l.value === settings.level)!.label}`
}

/** The same choices on two surfaces: thumb-sized controls and a read-only TV. */
export function RoomSetup({
  settings,
  onChange,
}: {
  settings: LobbyView['settings']
  onChange?: (region: Region, level: ContentLevel) => void
}) {
  return (
    <section
      className={`room-setup ${onChange ? 'room-setup--phone' : 'room-setup--stage'}`}
      data-testid="room-setup"
    >
      <h1>Where is this room?</h1>
      <p>Prompts come from where you are. Pick wrong and the jokes won’t land.</p>
      <fieldset className="room-setup__regions" aria-label="Region">
        {REGIONS.map((region) => {
          const selected = region.value === settings.region
          const content = (
            <>
              <strong>
                <span aria-hidden="true" className="room-setup__flag">
                  {region.flag ? <img src={region.flag} alt="" width={28} height={21} /> : '🌍'}
                </span>{' '}
                {region.label}
              </strong>
              <span>{region.hint}</span>
            </>
          )
          return onChange ? (
            <ClayButton
              key={region.value}
              seed={`region-${region.value}`}
              tone={selected ? 'brick' : 'card'}
              className="room-setup__choice"
              aria-pressed={selected}
              data-testid={`region-${region.value}`}
              onClick={() => onChange(region.value, settings.level)}
            >
              {content}
            </ClayButton>
          ) : (
            <Clay
              key={region.value}
              seed={`region-${region.value}`}
              tone={selected ? 'brick' : 'card'}
              className="room-setup__choice"
              data-selected={selected}
            >
              {content}
            </Clay>
          )
        })}
      </fieldset>
      <h2>How dark can it get?</h2>
      <div
        className="roast"
        style={{ '--roast-position': `${(settings.level - 1) * 50}%` } as CSSProperties}
      >
        <div className="roast__row">
          <div className="roast__face" aria-hidden="true">
            <i />
            <b />
          </div>
          <div className="roast__slider">
            <div className="roast__track" aria-hidden="true">
              <i />
              <i />
              <i />
            </div>
            <div className="roast__travel" aria-hidden="true">
              <div className="roast__knob" />
            </div>
            {onChange && (
              <input
                type="range"
                min={1}
                max={3}
                step={1}
                value={settings.level}
                className="roast__input"
                aria-label="How dark can it get?"
                aria-valuetext={LEVELS[settings.level - 1]!.label}
                data-testid="roast-slider"
                onChange={(event) =>
                  onChange(settings.region, Number(event.currentTarget.value) as ContentLevel)
                }
              />
            )}
          </div>
          <div className="roast__face roast__face--devil" aria-hidden="true">
            <i />
            <b />
            <em />
          </div>
        </div>
        <div className="roast__labels">
          {LEVELS.map((level) => (
            <span key={level.value} data-selected={settings.level === level.value}>
              {level.label}
            </span>
          ))}
        </div>
        {!onChange && (
          <p className="roast__accessible" role="status">
            Content level: {LEVELS[settings.level - 1]!.label}
          </p>
        )}
      </div>
    </section>
  )
}
