export type ShellRoute =
  | { kind: 'home' }
  | { kind: 'settings' }
  | { kind: 'lesson'; lessonId: string }
  | { kind: 'invalid'; requested: string }

export function parseShellRoute(hash: string): ShellRoute {
  const normalized = hash.replace(/^#/, '') || '/'
  if (normalized === '/') return { kind: 'home' }
  if (normalized === '/settings') return { kind: 'settings' }

  const lessonMatch = normalized.match(/^\/lesson\/([^/]+)$/)
  if (lessonMatch?.[1]) {
    return {
      kind: 'lesson',
      lessonId: decodeURIComponent(lessonMatch[1]),
    }
  }

  return { kind: 'invalid', requested: normalized }
}

export function routeHash(route: Exclude<ShellRoute, { kind: 'invalid' }>): string {
  if (route.kind === 'home') return '#/'
  if (route.kind === 'settings') return '#/settings'
  return `#/lesson/${encodeURIComponent(route.lessonId)}`
}
