import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import {
  completeLesson,
  createInitialShellState,
  getCourseStatus,
  getLessonProgress,
  getModuleForLesson,
  getModuleStatus,
  getRecommendedLesson,
  isLessonAvailable,
  loadShellState,
  recordSafeResumePoint,
  resolveLessonRoute,
  saveShellState,
  setNonvisualPreference,
  startLesson,
  type CourseDefinition,
  type LessonDefinition,
  type ShellState,
} from './model'
import { parseShellRoute, routeHash, type ShellRoute } from './routing'
import { Module1LessonApp } from '../module1/Module1LessonApp'
import {
  LESSON_COMPLETE_EVENT,
  LESSON_LOAD_FAILED_EVENT,
  LESSON_SAFE_POINT_EVENT,
  type LessonCompleteDetail,
  type LessonLoadFailedDetail,
  type LessonSafePointDetail,
} from './runtime-contract'

type LoadState =
  | { kind: 'loading' }
  | { kind: 'ready'; state: ShellState }
  | { kind: 'error'; message: string }

type RecoveryState =
  | { kind: 'save'; message: string; previousSafePoint: string | null }
  | {
      kind: 'completion'
      lessonId: string
      pendingState: ShellState
    }
  | { kind: 'lesson-load'; lessonId: string }

function currentHash(): string {
  return typeof window === 'undefined' ? '#/' : window.location.hash
}

function go(route: Exclude<ShellRoute, { kind: 'invalid' }>) {
  if (typeof window === 'undefined') return
  window.location.hash = routeHash(route)
}

function statusLabel(status: ReturnType<typeof getLessonProgress>['status']) {
  if (status === 'completed') return 'Completed'
  if (status === 'in-progress') return 'In progress'
  return 'Not started'
}

export function ShellApp({ course }: { course: CourseDefinition }) {
  const [loadState, setLoadState] = useState<LoadState>({ kind: 'loading' })
  const [route, setRoute] = useState<ShellRoute>(() =>
    parseShellRoute(currentHash()),
  )
  const [settingsReturn, setSettingsReturn] = useState<ShellRoute>({
    kind: 'home',
  })
  const [recovery, setRecovery] = useState<RecoveryState | null>(null)
  const [postLessonId, setPostLessonId] = useState<string | null>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const lastPersistedRef = useRef<ShellState>(createInitialShellState())

  const reloadPersistedState = useCallback(() => {
    if (typeof window === 'undefined') {
      setLoadState({ kind: 'ready', state: createInitialShellState() })
      return
    }

    setLoadState({ kind: 'loading' })
    try {
      const state = loadShellState(window.localStorage, course)
      lastPersistedRef.current = state
      setLoadState({ kind: 'ready', state })
    } catch (error) {
      setLoadState({
        kind: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Saved course state could not be read.',
      })
    }
  }, [course])

  useEffect(() => {
    reloadPersistedState()
  }, [reloadPersistedState])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const onHashChange = () => {
      setPostLessonId(null)
      setRecovery(null)
      setRoute(parseShellRoute(window.location.hash))
    }
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true })
  }, [route, postLessonId, recovery, loadState.kind])

  const readyState = loadState.kind === 'ready' ? loadState.state : null

  const persistCritical = useCallback(
    (
      next: ShellState,
      onSuccess: () => void,
      completionLessonId?: string,
    ) => {
      if (typeof window === 'undefined') return
      try {
        saveShellState(window.localStorage, next)
        lastPersistedRef.current = next
        setLoadState({ kind: 'ready', state: next })
        setRecovery(null)
        onSuccess()
      } catch {
        if (completionLessonId) {
          setRecovery({
            kind: 'completion',
            lessonId: completionLessonId,
            pendingState: next,
          })
        } else {
          setRecovery({
            kind: 'save',
            message: 'Your latest progress hasn\'t been saved yet.',
            previousSafePoint: null,
          })
        }
      }
    },
    [],
  )

  const persistLatest = useCallback((next: ShellState, lessonId?: string) => {
    if (typeof window === 'undefined') return
    setLoadState({ kind: 'ready', state: next })
    try {
      saveShellState(window.localStorage, next)
      lastPersistedRef.current = next
      setRecovery(null)
    } catch {
      const previousSafePoint = lessonId
        ? getLessonProgress(lastPersistedRef.current, lessonId).resumePoint
        : null
      setRecovery({
        kind: 'save',
        message: 'Your latest progress hasn\'t been saved yet.',
        previousSafePoint,
      })
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined' || !readyState) return

    const onSafePoint = (event: Event) => {
      const detail = (event as CustomEvent<LessonSafePointDetail>).detail
      if (
        !detail ||
        typeof detail.lessonId !== 'string' ||
        typeof detail.resumePoint !== 'string'
      ) {
        return
      }
      if (!course.modules.some((module) =>
        module.lessons.some((lesson) => lesson.id === detail.lessonId),
      )) {
        return
      }
      persistLatest(
        recordSafeResumePoint(readyState, detail.lessonId, detail.resumePoint),
        detail.lessonId,
      )
    }

    const onComplete = (event: Event) => {
      const detail = (event as CustomEvent<LessonCompleteDetail>).detail
      if (!detail || typeof detail.lessonId !== 'string') return
      if (!course.modules.some((module) =>
        module.lessons.some((lesson) => lesson.id === detail.lessonId),
      )) {
        return
      }

      const next = completeLesson(readyState, detail.lessonId)
      persistCritical(
        next,
        () => {
          if (getCourseStatus(course, next) === 'completed') {
            go({ kind: 'home' })
          } else {
            setPostLessonId(detail.lessonId)
          }
        },
        detail.lessonId,
      )
    }

    const onLoadFailed = (event: Event) => {
      const detail = (event as CustomEvent<LessonLoadFailedDetail>).detail
      if (!detail || typeof detail.lessonId !== 'string') return
      setRecovery({ kind: 'lesson-load', lessonId: detail.lessonId })
    }

    window.addEventListener(LESSON_SAFE_POINT_EVENT, onSafePoint)
    window.addEventListener(LESSON_COMPLETE_EVENT, onComplete)
    window.addEventListener(LESSON_LOAD_FAILED_EVENT, onLoadFailed)
    return () => {
      window.removeEventListener(LESSON_SAFE_POINT_EVENT, onSafePoint)
      window.removeEventListener(LESSON_COMPLETE_EVENT, onComplete)
      window.removeEventListener(LESSON_LOAD_FAILED_EVENT, onLoadFailed)
    }
  }, [course, persistCritical, persistLatest, readyState])

  useEffect(() => {
    if (!readyState || route.kind !== 'lesson' || recovery || postLessonId) return
    const resolution = resolveLessonRoute(course, readyState, route.lessonId)
    if (resolution.kind !== 'start') return

    const next = startLesson(readyState, route.lessonId)
    persistCritical(next, () => undefined)
  }, [course, persistCritical, postLessonId, readyState, recovery, route])

  const retrySave = () => {
    if (!readyState || typeof window === 'undefined') return
    try {
      saveShellState(window.localStorage, readyState)
      lastPersistedRef.current = readyState
      setRecovery(null)
    } catch {
      setRecovery((current) => current)
    }
  }

  const retryCompletion = () => {
    if (recovery?.kind !== 'completion' || typeof window === 'undefined') return
    try {
      saveShellState(window.localStorage, recovery.pendingState)
      lastPersistedRef.current = recovery.pendingState
      setLoadState({ kind: 'ready', state: recovery.pendingState })
      const lessonId = recovery.lessonId
      setRecovery(null)
      if (getCourseStatus(course, recovery.pendingState) === 'completed') {
        go({ kind: 'home' })
      } else {
        setPostLessonId(lessonId)
      }
    } catch {
      setRecovery((current) => current)
    }
  }

  if (loadState.kind === 'loading') {
    return (
      <ShellFrame courseTitle={course.title}>
        <main id="main-content" className="shell-main">
          <section className="status-panel" role="status" aria-live="polite">
            <span className="spinner" aria-hidden="true" />
            <h1 ref={headingRef} tabIndex={-1}>Loading your course…</h1>
          </section>
        </main>
      </ShellFrame>
    )
  }

  if (loadState.kind === 'error') {
    return (
      <ShellFrame courseTitle={course.title}>
        <main id="main-content" className="shell-main">
          <RecoveryPanel
            headingRef={headingRef}
            title="We couldn't load your course."
            detail={loadState.message}
            primaryLabel="Try again"
            onPrimary={reloadPersistedState}
          />
        </main>
      </ShellFrame>
    )
  }

  const state = loadState.state

  if (recovery?.kind === 'completion') {
    return (
      <ShellFrame courseTitle={course.title}>
        <main id="main-content" className="shell-main">
          <RecoveryPanel
            headingRef={headingRef}
            title="Your Lesson is finished, but we couldn't update your course progress."
            detail="Your next Lesson will stay unavailable until this update succeeds."
            primaryLabel="Try again"
            onPrimary={retryCompletion}
            secondaryLabel="Course Home"
            onSecondary={() => go({ kind: 'home' })}
          />
        </main>
      </ShellFrame>
    )
  }

  if (recovery?.kind === 'save') {
    return (
      <ShellFrame courseTitle={course.title}>
        <main id="main-content" className="shell-main">
          <RecoveryPanel
            headingRef={headingRef}
            title={recovery.message}
            detail={
              recovery.previousSafePoint
                ? `Your previous safe point is still available: ${recovery.previousSafePoint}.`
                : 'Your previous safely saved state is still available.'
            }
            primaryLabel="Try saving again"
            onPrimary={retrySave}
            secondaryLabel="Course Home"
            onSecondary={() => go({ kind: 'home' })}
          />
        </main>
      </ShellFrame>
    )
  }

  if (recovery?.kind === 'lesson-load') {
    return (
      <ShellFrame courseTitle={course.title}>
        <main id="main-content" className="shell-main">
          <RecoveryPanel
            headingRef={headingRef}
            title="This Lesson couldn't be loaded."
            detail="Your saved course progress has not been advanced."
            primaryLabel="Try again"
            onPrimary={() => setRecovery(null)}
            secondaryLabel="Course Home"
            onSecondary={() => go({ kind: 'home' })}
          />
        </main>
      </ShellFrame>
    )
  }

  if (postLessonId) {
    return (
      <PostLesson
        course={course}
        state={state}
        lessonId={postLessonId}
        headingRef={headingRef}
        onCourseHome={() => go({ kind: 'home' })}
        onContinue={(lesson) => go({ kind: 'lesson', lessonId: lesson.id })}
      />
    )
  }

  if (route.kind === 'invalid') {
    return (
      <ShellFrame courseTitle={course.title}>
        <main id="main-content" className="shell-main">
          <RouteRecovery
            headingRef={headingRef}
            title="We couldn't find that Lesson."
            course={course}
            state={state}
          />
        </main>
      </ShellFrame>
    )
  }

  if (route.kind === 'settings') {
    return (
      <SettingsPage
        courseTitle={course.title}
        state={state}
        headingRef={headingRef}
        onChange={(enabled) =>
          persistLatest(setNonvisualPreference(state, enabled))
        }
        onReturn={() => {
          const target =
            settingsReturn.kind === 'lesson' ? settingsReturn : { kind: 'home' as const }
          go(target)
        }}
        returnLabel={
          settingsReturn.kind === 'lesson' ? 'Return to Lesson' : 'Course Home'
        }
      />
    )
  }

  if (route.kind === 'lesson') {
    const resolution = resolveLessonRoute(course, state, route.lessonId)
    if (resolution.kind === 'invalid') {
      return (
        <ShellFrame courseTitle={course.title}>
          <main id="main-content" className="shell-main">
            <RouteRecovery
              headingRef={headingRef}
              title="We couldn't find that Lesson."
              course={course}
              state={state}
            />
          </main>
        </ShellFrame>
      )
    }
    if (resolution.kind === 'unavailable') {
      return (
        <ShellFrame courseTitle={course.title}>
          <main id="main-content" className="shell-main">
            <RouteRecovery
              headingRef={headingRef}
              title="This Lesson isn't available yet."
              course={course}
              state={state}
            />
          </main>
        </ShellFrame>
      )
    }
    if (resolution.kind === 'start') {
      return (
        <LessonLoading
          courseTitle={course.title}
          lesson={resolution.lesson}
          headingRef={headingRef}
          label="Opening"
        />
      )
    }

    return (
      <LessonBoundary
        courseTitle={course.title}
        lesson={resolution.lesson}
        mode={resolution.kind === 'revisit' ? 'revisit' : 'resume'}
        resumePoint={
          resolution.kind === 'resume' ? resolution.resumePoint : null
        }
        useNonvisualAlternatives={
          state.accessibility.useNonvisualAlternatives
        }
        headingRef={headingRef}
        onExit={() => go({ kind: 'home' })}
        onSettings={() => {
          setSettingsReturn({ kind: 'lesson', lessonId: resolution.lesson.id })
          go({ kind: 'settings' })
        }}
      />
    )
  }

  return (
    <CourseHome
      course={course}
      state={state}
      headingRef={headingRef}
      onSettings={() => {
        setSettingsReturn({ kind: 'home' })
        go({ kind: 'settings' })
      }}
      onLesson={(lesson) => {
        const resolution = resolveLessonRoute(course, state, lesson.id)
        if (resolution.kind === 'start') {
          const next = startLesson(state, lesson.id)
          persistCritical(next, () =>
            go({ kind: 'lesson', lessonId: lesson.id }),
          )
          return
        }
        go({ kind: 'lesson', lessonId: lesson.id })
      }}
      onPrimary={() => {
        const recommended = getRecommendedLesson(course, state)
        if (!recommended) return
        if (getLessonProgress(state, recommended.id).status === 'not-started') {
          const next = startLesson(state, recommended.id)
          persistCritical(next, () =>
            go({ kind: 'lesson', lessonId: recommended.id }),
          )
          return
        }
        go({ kind: 'lesson', lessonId: recommended.id })
      }}
    />
  )
}

function ShellFrame({
  courseTitle,
  children,
  lesson,
  onExit,
  onSettings,
}: {
  courseTitle: string
  children: ReactNode
  lesson?: LessonDefinition
  onExit?: () => void
  onSettings?: () => void
}) {
  return (
    <div className="site-shell">
      <a className="skip-link" href="#main-content">Skip to main content</a>
      <header className="top-bar">
        {lesson ? (
          <button className="text-action" type="button" onClick={onExit}>
            Exit Lesson
          </button>
        ) : (
          <button
            className="wordmark text-action"
            type="button"
            onClick={() => go({ kind: 'home' })}
            aria-label={`Yuzu · ${courseTitle} Course Home`}
          >
            Yuzu
          </button>
        )}
        {lesson ? <strong className="lesson-identity">{lesson.label}</strong> : null}
        <button
          className="text-action settings-action"
          type="button"
          onClick={onSettings ?? (() => go({ kind: 'settings' }))}
        >
          Settings &amp; accessibility
        </button>
      </header>
      {children}
    </div>
  )
}

function CourseHome({
  course,
  state,
  headingRef,
  onSettings,
  onLesson,
  onPrimary,
}: {
  course: CourseDefinition
  state: ShellState
  headingRef: React.RefObject<HTMLHeadingElement | null>
  onSettings: () => void
  onLesson: (lesson: LessonDefinition) => void
  onPrimary: () => void
}) {
  const courseStatus = getCourseStatus(course, state)
  const recommended = getRecommendedLesson(course, state)
  const recommendedModule = recommended
    ? getModuleForLesson(course, recommended.id)
    : null

  return (
    <ShellFrame courseTitle={course.title} onSettings={onSettings}>
      <main id="main-content" className="shell-main">
        <section className="home-hero">
          <p className="eyebrow">Yuzu</p>
          <h1 ref={headingRef} tabIndex={-1}>{course.title}</h1>
          {courseStatus === 'completed' ? (
            <>
              <p className="course-complete">Course complete</p>
              <p>The required course items are complete.</p>
            </>
          ) : recommended ? (
            <p>
              {recommendedModule?.label ?? 'Current Module'} · {recommended.label}
            </p>
          ) : (
            <p>Your course path will continue as curriculum items become available.</p>
          )}

          {recommended ? (
            <div className="primary-block">
              <strong>
                {state.courseStarted
                  ? `Continue · ${recommended.label}`
                  : recommended.label}
              </strong>
              <button className="button primary-button" type="button" onClick={onPrimary}>
                {state.courseStarted ? 'Continue' : 'Start Course'}
              </button>
            </div>
          ) : null}
        </section>

        <div className="course-path" aria-label="Course path">
          {course.modules.map((module) => {
            const moduleStatus = getModuleStatus(module, state)
            return (
              <section
                className={`module-group module-${moduleStatus}`}
                key={module.id}
                aria-labelledby={`${module.id}-heading`}
              >
                <div className="module-heading">
                  <h2 id={`${module.id}-heading`}>{module.label}</h2>
                  {moduleStatus === 'completed' ? (
                    <span className="state-label">✓ Complete</span>
                  ) : moduleStatus === 'in-progress' ? (
                    <span className="state-label">In progress</span>
                  ) : null}
                </div>
                <ol className="lesson-list">
                  {module.lessons.map((lesson) => {
                    const progress = getLessonProgress(state, lesson.id)
                    const available = isLessonAvailable(course, state, lesson.id)
                    const isRecommended = recommended?.id === lesson.id
                    return (
                      <li key={lesson.id}>
                        {available || progress.status !== 'not-started' ? (
                          <button
                            className={`lesson-row lesson-${progress.status}`}
                            type="button"
                            onClick={() => onLesson(lesson)}
                            aria-label={`${lesson.label} — ${statusLabel(progress.status)}${isRecommended ? ' — Recommended' : ''}`}
                          >
                            <span>
                              <strong>{lesson.label}</strong>
                              <span className="lesson-state">
                                {progress.status === 'completed'
                                  ? '✓ Completed'
                                  : progress.status === 'in-progress'
                                    ? 'In progress'
                                    : 'Available'}
                              </span>
                            </span>
                            <span className="row-end">
                              {isRecommended ? (
                                <span className="badge">Recommended</span>
                              ) : null}
                              <span aria-hidden="true">›</span>
                            </span>
                          </button>
                        ) : (
                          <div
                            className="lesson-row lesson-unavailable"
                            aria-label={`${lesson.label} — Unavailable`}
                          >
                            <span>
                              <strong>{lesson.label}</strong>
                              <span className="lesson-state">Unavailable</span>
                            </span>
                            <span aria-hidden="true">🔒</span>
                          </div>
                        )}
                      </li>
                    )
                  })}
                </ol>
              </section>
            )
          })}
        </div>
      </main>
    </ShellFrame>
  )
}

function LessonLoading({
  courseTitle,
  lesson,
  headingRef,
  label,
}: {
  courseTitle: string
  lesson: LessonDefinition
  headingRef: React.RefObject<HTMLHeadingElement | null>
  label: 'Opening' | 'Resuming'
}) {
  return (
    <ShellFrame courseTitle={courseTitle} lesson={lesson}>
      <main id="main-content" className="shell-main">
        <section className="status-panel" role="status" aria-live="polite">
          <span className="spinner" aria-hidden="true" />
          <h1 ref={headingRef} tabIndex={-1}>{label} {lesson.label}…</h1>
        </section>
      </main>
    </ShellFrame>
  )
}

function LessonBoundary({
  courseTitle,
  lesson,
  mode,
  resumePoint,
  useNonvisualAlternatives,
  headingRef,
  onExit,
  onSettings,
}: {
  courseTitle: string
  lesson: LessonDefinition
  mode: 'resume' | 'revisit'
  resumePoint: string | null
  useNonvisualAlternatives: boolean
  headingRef: React.RefObject<HTMLHeadingElement | null>
  onExit: () => void
  onSettings: () => void
}) {
  return (
    <ShellFrame
      courseTitle={courseTitle}
      lesson={lesson}
      onExit={onExit}
      onSettings={onSettings}
    >
      <main id="main-content" className="lesson-shell-main">
        <h1 ref={headingRef} tabIndex={-1} className="visually-hidden">
          {lesson.label}
        </h1>
        {mode === 'revisit' ? (
          <div className="revisit-banner" role="status">Revisit</div>
        ) : null}
        <section
          id="yuzu-lesson-runtime-root"
          className="lesson-runtime-slot"
          aria-label="Lesson content"
          data-lesson-id={lesson.id}
          data-lesson-mode={mode}
          data-resume-point={resumePoint ?? ''}
          data-use-nonvisual-alternatives={String(useNonvisualAlternatives)}
        >
          <Module1LessonApp
            lessonId={lesson.id}
            mode={mode}
            resumePoint={resumePoint}
            useNonvisualAlternatives={useNonvisualAlternatives}
          />
        </section>
      </main>
    </ShellFrame>
  )
}

function SettingsPage({
  courseTitle,
  state,
  headingRef,
  onChange,
  onReturn,
  returnLabel,
}: {
  courseTitle: string
  state: ShellState
  headingRef: React.RefObject<HTMLHeadingElement | null>
  onChange: (enabled: boolean) => void
  onReturn: () => void
  returnLabel: string
}) {
  return (
    <ShellFrame courseTitle={courseTitle}>
      <main id="main-content" className="shell-main settings-page">
        <h1 ref={headingRef} tabIndex={-1}>Settings &amp; accessibility</h1>
        <label className="settings-row">
          <span>
            <strong>Use nonvisual alternatives where available</strong>
            <span className="helper-text">
              Use an approved nonvisual route for activities where seeing the
              answer first would change the activity.
            </span>
          </span>
          <input
            type="checkbox"
            checked={state.accessibility.useNonvisualAlternatives}
            onChange={(event) => onChange(event.currentTarget.checked)}
          />
        </label>
        <p className="info-panel">
          Yuzu follows browser text scaling and your system reduced-motion preference.
        </p>
        <button className="button secondary-button" type="button" onClick={onReturn}>
          {returnLabel}
        </button>
      </main>
    </ShellFrame>
  )
}

function PostLesson({
  course,
  state,
  lessonId,
  headingRef,
  onCourseHome,
  onContinue,
}: {
  course: CourseDefinition
  state: ShellState
  lessonId: string
  headingRef: React.RefObject<HTMLHeadingElement | null>
  onCourseHome: () => void
  onContinue: (lesson: LessonDefinition) => void
}) {
  const lesson = course.modules
    .flatMap((module) => module.lessons)
    .find((candidate) => candidate.id === lessonId)
  const module = getModuleForLesson(course, lessonId)
  const recommended = getRecommendedLesson(course, state)

  return (
    <ShellFrame courseTitle={course.title}>
      <main id="main-content" className="shell-main continuation-card">
        <div className="completion-icon" aria-hidden="true">✓</div>
        <h1 ref={headingRef} tabIndex={-1}>Lesson complete</h1>
        {lessonId === 'lesson-2' ? (
          <>
            <p>Lesson complete. <span lang="uk">Привіт</span> and <span lang="uk">Бувай</span> will return.</p>
            <p>You worked with the beginning and end of a familiar interaction.</p>
          </>
        ) : lessonId === 'lesson-3' ? (
          <p>Lesson complete. You used the two words again in new situations.</p>
        ) : lessonId === 'lesson-4' ? (
          <p>Lesson complete. You worked with <span lang="uk">Привіт</span> and <span lang="uk">Бувай</span> again in new situations.</p>
        ) : (
          <p>{lesson?.label ?? 'Lesson'}</p>
        )}
        {module && getModuleStatus(module, state) === 'completed' ? (
          <div className="module-completion-copy">
            <p className="state-label">Module 1 complete.</p>
            <p>You worked with <span lang="uk">Привіт</span> and <span lang="uk">Бувай</span> in sound, print, and familiar opening and closing moments.</p>
            <p>These words and letter-sound links will return later.</p>
          </div>
        ) : null}
        {recommended ? (
          <>
            <p>Next: {recommended.label}</p>
            <button
              className="button primary-button"
              type="button"
              onClick={() => onContinue(recommended)}
            >
              Continue to next Lesson
            </button>
          </>
        ) : null}
        <button
          className="button secondary-button"
          type="button"
          onClick={onCourseHome}
        >
          Course Home
        </button>
      </main>
    </ShellFrame>
  )
}

function RouteRecovery({
  headingRef,
  title,
  course,
  state,
}: {
  headingRef: React.RefObject<HTMLHeadingElement | null>
  title: string
  course: CourseDefinition
  state: ShellState
}) {
  const recommended = getRecommendedLesson(course, state)
  return (
    <RecoveryPanel
      headingRef={headingRef}
      title={title}
      detail="Your saved course progress has not been changed."
      primaryLabel={recommended ? 'Continue' : 'Course Home'}
      onPrimary={() =>
        recommended
          ? go({ kind: 'lesson', lessonId: recommended.id })
          : go({ kind: 'home' })
      }
      secondaryLabel={recommended ? 'Course Home' : undefined}
      onSecondary={recommended ? () => go({ kind: 'home' }) : undefined}
    />
  )
}

function RecoveryPanel({
  headingRef,
  title,
  detail,
  primaryLabel,
  onPrimary,
  secondaryLabel,
  onSecondary,
}: {
  headingRef: React.RefObject<HTMLHeadingElement | null>
  title: string
  detail: string
  primaryLabel: string
  onPrimary: () => void
  secondaryLabel?: string
  onSecondary?: () => void
}) {
  return (
    <section className="status-panel error-panel" role="alert">
      <h1 ref={headingRef} tabIndex={-1}>{title}</h1>
      <p>{detail}</p>
      <div className="button-row">
        <button className="button primary-button" type="button" onClick={onPrimary}>
          {primaryLabel}
        </button>
        {secondaryLabel && onSecondary ? (
          <button
            className="button secondary-button"
            type="button"
            onClick={onSecondary}
          >
            {secondaryLabel}
          </button>
        ) : null}
      </div>
    </section>
  )
}
