import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { App } from './App'

describe('Yuzu MVP application shell', () => {
  it('renders the shell loading boundary before persisted state resolves', () => {
    const markup = renderToStaticMarkup(<App />)

    expect(markup).toContain('Loading your course')
    expect(markup).toContain('Settings &amp; accessibility')
    expect(markup).toContain('Skip to main content')
  })
})
