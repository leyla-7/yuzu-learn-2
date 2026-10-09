export type LessonProgressStatus = 'not-started' | 'in-progress' | 'completed'

export interface LessonDefinition {
  id: string
  label: string
  required: boolean
  prerequisiteLessonIds?: readonly string[]
}

export interface ModuleDefinition {
  id: string
  label: string
  definitionComplete: boolean
  lessons: readonly LessonDefinition[]
}

export interface CourseDefinition {
  id: string
  title: string
  definitionComplete: boolean
  modules: readonly ModuleDefinition[]
}

export interface LessonProgress {
  status: LessonProgressStatus
  resumePoint: string | null
}

export interface ShellState {
  version: 1
  courseStarted: boolean
  lessons: Record<string, LessonProgress>
  accessibility: {
    useNonvisualAlternatives: boolean
  }
}

export type CourseStatus = 'not-started' | 'in-progress' | 'completed'
export type ModuleStatus = 'not-started' | 'in-progress' | 'completed'

export type LessonRouteResolution =
  | { kind: 'invalid' }
  | { kind: 'unavailable'; lesson: LessonDefinition }
  | { kind: 'start'; lesson: LessonDefinition }
  | { kind: 'resume'; lesson: LessonDefinition; resumePoint: string | null }
  | { kind: 'revisit'; lesson: LessonDefinition }

export const SHELL_STORAGE_KEY = 'yuzu.shell.v1'

export const UKRAINIAN_A1_SHELL_SLICE: CourseDefinition = {
  id: 'ukrainian-a1',
  title: 'Ukrainian A1',
  definitionComplete: false,
  modules: [
    {
      id: 'module-1',
      label: 'Module 1',
      definitionComplete: true,
      lessons: [
        {
          id: 'lesson-1',
          label: 'Lesson 1',
          required: true,
        },
        {
          id: 'lesson-2',
          label: 'Lesson 2',
          required: true,
          prerequisiteLessonIds: ['lesson-1'],
        },
        {
          id: 'lesson-3',
          label: 'Lesson 3',
          required: true,
          prerequisiteLessonIds: ['lesson-2'],
        },
        {
          id: 'lesson-4',
          label: 'Lesson 4',
          required: true,
          prerequisiteLessonIds: ['lesson-3'],
        },
      ],
    },
  ],
}

export function createInitialShellState(): ShellState {
  return {
    version: 1,
    courseStarted: false,
    lessons: {},
    accessibility: {
      useNonvisualAlternatives: false,
    },
  }
}

export function getLessons(course: CourseDefinition): readonly LessonDefinition[] {
  return course.modules.flatMap((module) => module.lessons)
}

export function getLesson(
  course: CourseDefinition,
  lessonId: string,
): LessonDefinition | null {
  return getLessons(course).find((lesson) => lesson.id === lessonId) ?? null
}

export function getModuleForLesson(
  course: CourseDefinition,
  lessonId: string,
): ModuleDefinition | null {
  return (
    course.modules.find((module) =>
      module.lessons.some((lesson) => lesson.id === lessonId),
    ) ?? null
  )
}

export function getLessonProgress(
  state: ShellState,
  lessonId: string,
): LessonProgress {
  return (
    state.lessons[lessonId] ?? {
      status: 'not-started',
      resumePoint: null,
    }
  )
}

export function isLessonAvailable(
  course: CourseDefinition,
  state: ShellState,
  lessonId: string,
): boolean {
  const lesson = getLesson(course, lessonId)
  if (!lesson) return false

  const progress = getLessonProgress(state, lessonId)
  if (progress.status === 'in-progress' || progress.status === 'completed') {
    return true
  }

  return (lesson.prerequisiteLessonIds ?? []).every(
    (prerequisiteId) =>
      getLessonProgress(state, prerequisiteId).status === 'completed',
  )
}

export function resolveLessonRoute(
  course: CourseDefinition,
  state: ShellState,
  lessonId: string,
): LessonRouteResolution {
  const lesson = getLesson(course, lessonId)
  if (!lesson) return { kind: 'invalid' }

  const progress = getLessonProgress(state, lessonId)
  if (progress.status === 'completed') {
    return { kind: 'revisit', lesson }
  }
  if (progress.status === 'in-progress') {
    return {
      kind: 'resume',
      lesson,
      resumePoint: progress.resumePoint,
    }
  }
  if (!isLessonAvailable(course, state, lessonId)) {
    return { kind: 'unavailable', lesson }
  }

  return { kind: 'start', lesson }
}

export function getRecommendedLesson(
  course: CourseDefinition,
  state: ShellState,
): LessonDefinition | null {
  const requiredLessons = getLessons(course).filter((lesson) => lesson.required)
  const interrupted = requiredLessons.find(
    (lesson) => getLessonProgress(state, lesson.id).status === 'in-progress',
  )
  if (interrupted) return interrupted

  return (
    requiredLessons.find(
      (lesson) =>
        getLessonProgress(state, lesson.id).status === 'not-started' &&
        isLessonAvailable(course, state, lesson.id),
    ) ?? null
  )
}

export function getCourseStatus(
  course: CourseDefinition,
  state: ShellState,
): CourseStatus {
  const requiredLessons = getLessons(course).filter((lesson) => lesson.required)
  const allRequiredComplete =
    requiredLessons.length > 0 &&
    requiredLessons.every(
      (lesson) => getLessonProgress(state, lesson.id).status === 'completed',
    )

  if (course.definitionComplete && allRequiredComplete) return 'completed'
  if (
    state.courseStarted ||
    requiredLessons.some(
      (lesson) => getLessonProgress(state, lesson.id).status !== 'not-started',
    )
  ) {
    return 'in-progress'
  }
  return 'not-started'
}

export function getModuleStatus(
  module: ModuleDefinition,
  state: ShellState,
): ModuleStatus {
  const requiredLessons = module.lessons.filter((lesson) => lesson.required)
  const allRequiredComplete =
    requiredLessons.length > 0 &&
    requiredLessons.every(
      (lesson) => getLessonProgress(state, lesson.id).status === 'completed',
    )

  if (module.definitionComplete && allRequiredComplete) return 'completed'
  if (
    requiredLessons.some(
      (lesson) => getLessonProgress(state, lesson.id).status !== 'not-started',
    )
  ) {
    return 'in-progress'
  }
  return 'not-started'
}

export function startCourse(state: ShellState): ShellState {
  if (state.courseStarted) return state
  return { ...state, courseStarted: true }
}

export function startLesson(state: ShellState, lessonId: string): ShellState {
  const progress = getLessonProgress(state, lessonId)
  if (progress.status === 'completed' || progress.status === 'in-progress') {
    return state.courseStarted ? state : { ...state, courseStarted: true }
  }

  return {
    ...state,
    courseStarted: true,
    lessons: {
      ...state.lessons,
      [lessonId]: {
        status: 'in-progress',
        resumePoint: null,
      },
    },
  }
}

export function recordSafeResumePoint(
  state: ShellState,
  lessonId: string,
  resumePoint: string,
): ShellState {
  const progress = getLessonProgress(state, lessonId)
  if (progress.status !== 'in-progress') return state

  return {
    ...state,
    lessons: {
      ...state.lessons,
      [lessonId]: {
        status: 'in-progress',
        resumePoint,
      },
    },
  }
}

export function completeLesson(
  state: ShellState,
  lessonId: string,
): ShellState {
  return {
    ...state,
    courseStarted: true,
    lessons: {
      ...state.lessons,
      [lessonId]: {
        status: 'completed',
        resumePoint: null,
      },
    },
  }
}

export function setNonvisualPreference(
  state: ShellState,
  enabled: boolean,
): ShellState {
  return {
    ...state,
    accessibility: {
      ...state.accessibility,
      useNonvisualAlternatives: enabled,
    },
  }
}

export function normalizeShellState(
  course: CourseDefinition,
  candidate: unknown,
): ShellState {
  if (!candidate || typeof candidate !== 'object') {
    throw new Error('Saved course state is not an object.')
  }

  const raw = candidate as {
    version?: unknown
    courseStarted?: unknown
    lessons?: unknown
    accessibility?: unknown
  }

  if (raw.version !== 1) {
    throw new Error('Saved course state version is unsupported.')
  }
  if (typeof raw.courseStarted !== 'boolean') {
    throw new Error('Saved course start state is invalid.')
  }
  if (!raw.lessons || typeof raw.lessons !== 'object') {
    throw new Error('Saved Lesson state is invalid.')
  }

  const lessons: Record<string, LessonProgress> = {}
  for (const lesson of getLessons(course)) {
    const value = (raw.lessons as Record<string, unknown>)[lesson.id]
    if (value === undefined) continue
    if (!value || typeof value !== 'object') {
      throw new Error(`Saved state for ${lesson.id} is invalid.`)
    }

    const progress = value as { status?: unknown; resumePoint?: unknown }
    if (
      progress.status !== 'not-started' &&
      progress.status !== 'in-progress' &&
      progress.status !== 'completed'
    ) {
      throw new Error(`Saved status for ${lesson.id} is invalid.`)
    }
    if (
      progress.resumePoint !== null &&
      progress.resumePoint !== undefined &&
      typeof progress.resumePoint !== 'string'
    ) {
      throw new Error(`Saved resume point for ${lesson.id} is invalid.`)
    }

    if (progress.status !== 'not-started') {
      lessons[lesson.id] = {
        status: progress.status,
        resumePoint:
          progress.status === 'in-progress' && typeof progress.resumePoint === 'string'
            ? progress.resumePoint
            : null,
      }
    }
  }

  const accessibility = raw.accessibility
  if (!accessibility || typeof accessibility !== 'object') {
    throw new Error('Saved accessibility state is invalid.')
  }
  const useNonvisualAlternatives = (
    accessibility as { useNonvisualAlternatives?: unknown }
  ).useNonvisualAlternatives
  if (typeof useNonvisualAlternatives !== 'boolean') {
    throw new Error('Saved accessibility preference is invalid.')
  }

  return {
    version: 1,
    courseStarted:
      raw.courseStarted ||
      Object.values(lessons).some(
        (progress) => progress.status !== 'not-started',
      ),
    lessons,
    accessibility: {
      useNonvisualAlternatives,
    },
  }
}

export function loadShellState(
  storage: Pick<Storage, 'getItem'>,
  course: CourseDefinition,
): ShellState {
  const raw = storage.getItem(SHELL_STORAGE_KEY)
  if (raw === null) return createInitialShellState()

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new Error('Saved course state could not be read.')
  }

  return normalizeShellState(course, parsed)
}

export function saveShellState(
  storage: Pick<Storage, 'setItem'>,
  state: ShellState,
): void {
  storage.setItem(SHELL_STORAGE_KEY, JSON.stringify(state))
}
