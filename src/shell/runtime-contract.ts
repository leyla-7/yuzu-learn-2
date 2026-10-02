export const LESSON_SAFE_POINT_EVENT = 'yuzu:lesson-safe-point'
export const LESSON_COMPLETE_EVENT = 'yuzu:lesson-complete'
export const LESSON_LOAD_FAILED_EVENT = 'yuzu:lesson-load-failed'

export interface LessonSafePointDetail {
  lessonId: string
  resumePoint: string
}

export interface LessonCompleteDetail {
  lessonId: string
}

export interface LessonLoadFailedDetail {
  lessonId: string
}
