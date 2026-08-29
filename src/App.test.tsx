import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { App } from './App'

describe('technical application shell', () => {
  it('renders a neutral main landmark', () => {
    const markup = renderToStaticMarkup(<App />)

    expect(markup).toContain('<main')
    expect(markup).toContain('Yuzu Learn 2.0')
    expect(markup).toContain('Technical foundation')
  })
})
