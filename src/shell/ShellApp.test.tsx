import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { ShellApp } from './ShellApp'
import { UKRAINIAN_A1_SHELL_SLICE } from './model'

describe('MVP shell render boundary', () => {
  it('server-renders a neutral loading state without guessing Start or Continue', () => {
    const markup = renderToStaticMarkup(
      <ShellApp course={UKRAINIAN_A1_SHELL_SLICE} />,
    )

    expect(markup).toContain('Loading your course')
    expect(markup).not.toContain('Start Course')
    expect(markup).not.toContain('>Continue<')
  })
})
