import { describe, expect, it } from 'vitest'
import {
  createEvidenceRecord,
  recordAnswerBearingRecovery,
  recordAttempt,
  recordHelp,
} from './evidence'
import {
  createSafeResumePoint,
  decodeSafeResumePoint,
  encodeSafeResumePoint,
  toShellSafePointDetail,
} from './resume'

describe('Module-1 safe resume contract', () => {
  it('serializes a pre-attempt checkpoint into the existing shell safe-point interface', () => {
    const point = createSafeResumePoint({
      lessonId: 'lesson-2',
      checkpointId: 'l2-before-w2-evidence',
      boundary: 'before-first-attempt',
      evidence: createEvidenceRecord(),
    })

    const detail = toShellSafePointDetail(point)
    expect(detail.lessonId).toBe('lesson-2')
    expect(decodeSafeResumePoint(detail.resumePoint)).toEqual(point)
  })

  it('preserves Help provenance instead of silently restoring an independent attempt', () => {
    const helped = recordHelp(recordAttempt(createEvidenceRecord()))
    const point = createSafeResumePoint({
      lessonId: 'lesson-3',
      checkpointId: 'l3-after-help',
      boundary: 'after-help',
      evidence: helped,
    })

    const restored = decodeSafeResumePoint(encodeSafeResumePoint(point))
    expect(restored.evidence?.helpUsed).toBe(true)
    expect(restored.evidence?.provenance).toBe('help-used')
  })

  it('preserves answer-bearing recovery provenance across resume', () => {
    const recovered = recordAnswerBearingRecovery(
      recordAttempt(createEvidenceRecord()),
    )
    const point = createSafeResumePoint({
      lessonId: 'lesson-4',
      checkpointId: 'l4-after-full-recovery',
      boundary: 'after-answer-bearing-recovery',
      evidence: recovered,
    })

    expect(
      decodeSafeResumePoint(encodeSafeResumePoint(point)).evidence
        ?.answerBearingRecoveryUsed,
    ).toBe(true)
  })

  it('rejects resume points that would erase Help/recovery state', () => {
    const helped = recordHelp(recordAttempt(createEvidenceRecord()))

    expect(() =>
      createSafeResumePoint({
        lessonId: 'lesson-3',
        checkpointId: 'bad-independent-retry',
        boundary: 'before-retry',
        evidence: helped,
      }),
    ).toThrow('cannot erase Help/recovery provenance')
  })

  it('cannot persist Lesson completion at a non-completion boundary', () => {
    expect(() =>
      createSafeResumePoint({
        lessonId: 'lesson-4',
        checkpointId: 'bad-complete',
        boundary: 'between-items',
        lessonCompletionEmitted: true,
      }),
    ).toThrow('may only be persisted at the Lesson-complete boundary')
  })

  it('never serializes a resume point that leaks answer-bearing exposure', () => {
    const point = createSafeResumePoint({
      lessonId: 'lesson-2',
      checkpointId: 'safe',
      boundary: 'between-items',
    })

    expect(point.exposure).toEqual({
      answerBearingPrintWouldBeVisible: false,
      answerBearingTargetAudioWouldAutoplay: false,
      completedOrthographicAnswerWouldBeVisible: false,
    })
  })
})
