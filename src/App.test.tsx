import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { App } from './App'

describe('Lesson 1 browser shell', () => {
  it('opens directly on the accepted greeting encounter', () => {
    const markup = renderToStaticMarkup(<App />)

    expect(markup).toContain('<main')
    expect(markup).toContain('Привіт')
    expect(markup).toContain('Replay')
    expect(markup).toContain('Continue')
    expect(markup).not.toContain('Technical foundation')
  })
})
