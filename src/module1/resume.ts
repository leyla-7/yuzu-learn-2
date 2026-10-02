import type { LessonSafePointDetail } from '../shell/runtime-contract'
import type { EvidenceRecord, EvidenceProvenance } from './evidence'
import type { Module1LessonId } from './lesson-contracts'

export type ResumeBoundary =
  | 'before-first-attempt'
  | 'before-retry'
  | 'after-help'
  | 'after-supported-recovery'
  | 'after-answer-bearing-recovery'
  | 'between-items'
  | 'lesson-complete'

export interface ResumeExposureGuard {
  answerBearingPrintWouldBeVisible: false
  answerBearingTargetAudioWouldAutoplay: false
  completedOrthographicAnswerWouldBeVisible: false
}

export interface Module1SafeResumePoint {
  version: 1
  lessonId: Module1LessonId
  checkpointId: string
  boundary: ResumeBoundary
  evidence: EvidenceRecord | null
  lessonCompletionEmitted: boolean
  exposure: ResumeExposureGuard
}

function assertBoundaryMatchesEvidence(
  boundary: ResumeBoundary,
  evidence: EvidenceRecord | null,
): void {
  const provenance: EvidenceProvenance = evidence?.provenance ?? 'not-attempted'

  if (boundary === 'before-first-attempt' && provenance !== 'not-attempted') {
    throw new Error(
      'A before-first-attempt resume point must preserve not-attempted provenance.',
    )
  }

  if (boundary === 'before-retry') {
    if (
      provenance !== 'first-attempt' &&
      provenance !== 'retry-without-help'
    ) {
      throw new Error(
        'A before-retry resume point cannot erase Help/recovery provenance.',
      )
    }
  }

  if (boundary === 'after-help' && !evidence?.helpUsed) {
    throw new Error('An after-help resume point must preserve Help provenance.')
  }

  if (
    boundary === 'after-supported-recovery' &&
    !evidence?.supportedRecoveryUsed
  ) {
    throw new Error(
      'An after-supported-recovery resume point must preserve recovery provenance.',
    )
  }

  if (
    boundary === 'after-answer-bearing-recovery' &&
    !evidence?.answerBearingRecoveryUsed
  ) {
    throw new Error(
      'An after-answer-bearing-recovery resume point must preserve answer-bearing recovery provenance.',
    )
  }
}

export function createSafeResumePoint(input: {
  lessonId: Module1LessonId
  checkpointId: string
  boundary: ResumeBoundary
  evidence?: EvidenceRecord | null
  lessonCompletionEmitted?: boolean
}): Module1SafeResumePoint {
  if (!input.checkpointId.trim()) {
    throw new Error('Safe resume checkpoint id is required.')
  }

  const evidence = input.evidence ?? null
  const lessonCompletionEmitted = input.lessonCompletionEmitted ?? false

  if (lessonCompletionEmitted && input.boundary !== 'lesson-complete') {
    throw new Error(
      'A Lesson completion flag may only be persisted at the Lesson-complete boundary.',
    )
  }
  if (!lessonCompletionEmitted && input.boundary === 'lesson-complete') {
    throw new Error(
      'A Lesson-complete resume boundary requires a real completion event.',
    )
  }

  assertBoundaryMatchesEvidence(input.boundary, evidence)

  return {
    version: 1,
    lessonId: input.lessonId,
    checkpointId: input.checkpointId,
    boundary: input.boundary,
    evidence,
    lessonCompletionEmitted,
    exposure: {
      answerBearingPrintWouldBeVisible: false,
      answerBearingTargetAudioWouldAutoplay: false,
      completedOrthographicAnswerWouldBeVisible: false,
    },
  }
}

export function encodeSafeResumePoint(point: Module1SafeResumePoint): string {
  return JSON.stringify(point)
}

export function decodeSafeResumePoint(serialized: string): Module1SafeResumePoint {
  let parsed: unknown
  try {
    parsed = JSON.parse(serialized)
  } catch {
    throw new Error('Module-1 safe resume point is not valid JSON.')
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Module-1 safe resume point is invalid.')
  }

  const candidate = parsed as Partial<Module1SafeResumePoint>
  if (
    candidate.version !== 1 ||
    (candidate.lessonId !== 'lesson-2' &&
      candidate.lessonId !== 'lesson-3' &&
      candidate.lessonId !== 'lesson-4') ||
    typeof candidate.checkpointId !== 'string' ||
    typeof candidate.boundary !== 'string' ||
    typeof candidate.lessonCompletionEmitted !== 'boolean' ||
    !candidate.exposure ||
    candidate.exposure.answerBearingPrintWouldBeVisible !== false ||
    candidate.exposure.answerBearingTargetAudioWouldAutoplay !== false ||
    candidate.exposure.completedOrthographicAnswerWouldBeVisible !== false
  ) {
    throw new Error('Module-1 safe resume point failed validation.')
  }

  const point = candidate as Module1SafeResumePoint
  if (point.lessonCompletionEmitted && point.boundary !== 'lesson-complete') {
    throw new Error('Module-1 safe resume point has false completion state.')
  }
  assertBoundaryMatchesEvidence(point.boundary, point.evidence)

  return point
}

export function toShellSafePointDetail(
  point: Module1SafeResumePoint,
): LessonSafePointDetail {
  return {
    lessonId: point.lessonId,
    resumePoint: encodeSafeResumePoint(point),
  }
}
