import { describe, expect, it } from 'vitest'
import { parseShellRoute, routeHash } from './routing'

describe('hash routing', () => {
  it('maps stable browser URLs to shell surfaces', () => {
    expect(parseShellRoute('')).toEqual({ kind: 'home' })
    expect(parseShellRoute('#/')).toEqual({ kind: 'home' })
    expect(parseShellRoute('#/settings')).toEqual({ kind: 'settings' })
    expect(parseShellRoute('#/lesson/lesson-1')).toEqual({
      kind: 'lesson',
      lessonId: 'lesson-1',
    })
  })

  it('keeps invalid routes explicit for safe recovery', () => {
    expect(parseShellRoute('#/unknown')).toEqual({
      kind: 'invalid',
      requested: '/unknown',
    })
  })

  it('encodes Lesson ids when building direct routes', () => {
    expect(routeHash({ kind: 'lesson', lessonId: 'lesson / 1' })).toBe(
      '#/lesson/lesson%20%2F%201',
    )
  })
})
