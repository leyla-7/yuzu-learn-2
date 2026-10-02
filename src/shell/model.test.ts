import { describe, expect, it } from 'vitest'
import {
  SHELL_STORAGE_KEY,
  completeLesson,
  createInitialShellState,
  getCourseStatus,
  getModuleStatus,
  getRecommendedLesson,
  isLessonAvailable,
  loadShellState,
  normalizeShellState,
  recordSafeResumePoint,
  resolveLessonRoute,
  saveShellState,
  setNonvisualPreference,
  startCourse,
  startLesson,
  type CourseDefinition,
} from './model'

const course: CourseDefinition = {
  id: 'test-course',
  title: 'Ukrainian A1',
  definitionComplete: true,
  modules: [
    {
      id: 'm1',
      label: 'Module 1',
      definitionComplete: true,
      lessons: [
        { id: 'l1', label: 'Lesson 1', required: true },
        {
          id: 'l2',
          label: 'Lesson 2',
          required: true,
          prerequisiteLessonIds: ['l1'],
        },
      ],
    },
    {
      id: 'm2',
      label: 'Module 2',
      definitionComplete: true,
      lessons: [{ id: 'l3', label: 'Lesson 3', required: true }],
    },
  ],
}

function memoryStorage(initial: string | null = null) {
  let value = initial
  return {
    getItem(key: string) {
      return key === SHELL_STORAGE_KEY ? value : null
    },
    setItem(key: string, next: string) {
      if (key === SHELL_STORAGE_KEY) value = next
    },
    read() {
      return value
    },
  }
}

describe('MVP shell state model', () => {
  it('starts with one recommended available required Lesson', () => {
    const state = createInitialShellState()
    expect(getCourseStatus(course, state)).toBe('not-started')
    expect(getRecommendedLesson(course, state)?.id).toBe('l1')
    expect(isLessonAvailable(course, state, 'l1')).toBe(true)
    expect(isLessonAvailable(course, state, 'l2')).toBe(false)
  })

  it('keeps prerequisite availability curriculum-driven', () => {
    const state = completeLesson(startLesson(createInitialShellState(), 'l1'), 'l1')
    expect(isLessonAvailable(course, state, 'l2')).toBe(true)
    expect(resolveLessonRoute(course, state, 'l2').kind).toBe('start')
  })

  it('prioritizes an interrupted required Lesson over a later available Lesson', () => {
    let state = startCourse(createInitialShellState())
    state = startLesson(state, 'l3')
    expect(getRecommendedLesson(course, state)?.id).toBe('l3')
  })

  it('preserves a runtime safe resume pointer for in-progress Lessons', () => {
    let state = startLesson(createInitialShellState(), 'l1')
    state = recordSafeResumePoint(state, 'l1', 'checkpoint-7')
    expect(resolveLessonRoute(course, state, 'l1')).toEqual({
      kind: 'resume',
      lesson: course.modules[0]?.lessons[0],
      resumePoint: 'checkpoint-7',
    })
  })

  it('does not let a completed-Lesson revisit regress completion', () => {
    let state = completeLesson(createInitialShellState(), 'l1')
    expect(resolveLessonRoute(course, state, 'l1').kind).toBe('revisit')
    state = recordSafeResumePoint(state, 'l1', 'should-not-stick')
    expect(resolveLessonRoute(course, state, 'l1').kind).toBe('revisit')
    expect(state.lessons.l1?.resumePoint).toBeNull()
  })

  it('derives Module and Course completion only from complete definitions', () => {
    let state = createInitialShellState()
    state = completeLesson(state, 'l1')
    state = completeLesson(state, 'l2')
    expect(getModuleStatus(course.modules[0]!, state)).toBe('completed')
    expect(getCourseStatus(course, state)).toBe('in-progress')

    state = completeLesson(state, 'l3')
    expect(getCourseStatus(course, state)).toBe('completed')
  })

  it('never claims completion for an explicitly incomplete course definition', () => {
    const partial: CourseDefinition = { ...course, definitionComplete: false }
    let state = createInitialShellState()
    for (const lesson of course.modules.flatMap((module) => module.lessons)) {
      state = completeLesson(state, lesson.id)
    }
    expect(getCourseStatus(partial, state)).toBe('in-progress')
  })

  it('persists the nonvisual-route preference independently of progress', () => {
    const state = setNonvisualPreference(createInitialShellState(), true)
    expect(state.accessibility.useNonvisualAlternatives).toBe(true)
    expect(state.courseStarted).toBe(false)
  })

  it('round-trips supported local state and ignores unknown historical Lesson ids', () => {
    const storage = memoryStorage()
    let state = startLesson(createInitialShellState(), 'l1')
    state = recordSafeResumePoint(state, 'l1', 'safe-point')
    state = setNonvisualPreference(state, true)
    saveShellState(storage, state)

    const loaded = loadShellState(storage, course)
    expect(loaded).toEqual(state)

    const withUnknown = {
      ...state,
      lessons: {
        ...state.lessons,
        retired: { status: 'completed', resumePoint: null },
      },
    }
    const normalized = normalizeShellState(course, withUnknown)
    expect(normalized.lessons.retired).toBeUndefined()
  })

  it('fails closed on corrupt persisted data instead of guessing progress', () => {
    const storage = memoryStorage('{broken')
    expect(() => loadShellState(storage, course)).toThrow(
      'Saved course state could not be read.',
    )
  })

  it('rejects unsupported persisted schema versions', () => {
    expect(() =>
      normalizeShellState(course, {
        version: 2,
        courseStarted: false,
        lessons: {},
        accessibility: { useNonvisualAlternatives: false },
      }),
    ).toThrow('Saved course state version is unsupported.')
  })

  it('distinguishes invalid, unavailable, start, resume and revisit routes', () => {
    const initial = createInitialShellState()
    expect(resolveLessonRoute(course, initial, 'missing').kind).toBe('invalid')
    expect(resolveLessonRoute(course, initial, 'l2').kind).toBe('unavailable')
    expect(resolveLessonRoute(course, initial, 'l1').kind).toBe('start')

    const active = startLesson(initial, 'l1')
    expect(resolveLessonRoute(course, active, 'l1').kind).toBe('resume')

    const completed = completeLesson(active, 'l1')
    expect(resolveLessonRoute(course, completed, 'l1').kind).toBe('revisit')
  })
})
