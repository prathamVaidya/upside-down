import { Wordmark } from '@ud/clay'
import policy from '../../../../docs/privacy-policy.md?raw'
import './privacy.css'

const anchor = (title: string) =>
  title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

/** Small renderer for our trusted, repository-owned policy; never inject raw HTML. */
function inline(text: string) {
  return text
    .replace(/\n/g, ' ')
    .split(/(\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/g)
    .map((part) => {
      const link = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/)
      if (link && /^(https:\/\/|mailto:|\/)/.test(link[2]!))
        return (
          <a key={part} href={link[2]}>
            {link[1]}
          </a>
        )
      if (part.startsWith('**') && part.endsWith('**'))
        return <strong key={part}>{part.slice(2, -2)}</strong>
      return part
    })
}

export function Privacy() {
  const sections = [...policy.matchAll(/^## (.+)$/gm)].map((m) => m[1]!)
  return (
    <main className="privacy-page">
      <header className="privacy-page__header">
        <a href="/" aria-label="Upside Down home">
          <Wordmark size={20} />
        </a>
        <a href="/">Back to the game</a>
      </header>
      <nav aria-label="Policy sections" className="privacy-page__contents">
        <p>On this page</p>
        {sections.map((title) => (
          <a key={title} href={`#${anchor(title)}`}>
            {title}
          </a>
        ))}
      </nav>
      <article className="privacy-page__article">
        {policy
          .trim()
          .split(/\n\s*\n/)
          .map((block) => {
            if (block.startsWith('# ')) return <h1 key={block}>{block.slice(2)}</h1>
            if (block.startsWith('## '))
              return (
                <h2 key={block} id={anchor(block.slice(3))}>
                  {block.slice(3)}
                </h2>
              )
            if (block.startsWith('> '))
              return (
                <aside className="privacy-page__notice" key={block}>
                  {inline(block.replace(/^> ?/gm, ''))}
                </aside>
              )
            if (block.startsWith('- '))
              return (
                <ul key={block}>
                  {block.split(/\n(?=- )/).map((item) => (
                    <li key={item}>{inline(item.slice(2))}</li>
                  ))}
                </ul>
              )
            return <p key={block}>{inline(block)}</p>
          })}
      </article>
      <footer className="privacy-page__footer">
        <a href="/">Back to the game</a>
      </footer>
    </main>
  )
}
