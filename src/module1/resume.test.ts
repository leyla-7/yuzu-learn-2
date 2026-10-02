import { describe, expect, it } from 'vitest'
import {
  MODULE1_CONSTRUCTION_CONTRACTS,
  appendConstructionGrapheme,
  createConstructionState,
} from './construction'
import {
  createEvidenceRecord,
  exposeEvidenceStimulus,
  recordAnswerBearingRecovery,
  recordHelp,
  recordResponse,
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

  it('preserves the same active attempt ID when interrupted after stimulus exposure', () => {
    const evidence = exposeEvidenceStimulus(
      createEvidenceRecord(),
      'l3-listen-attempt-1',
    )
    const point = createSafeResumePoint({
      lessonId: 'lesson-3',
      checkpointId: 'l3-listening-active',
      boundary: 'active-attempt',
      evidence,
    })

    const restored = decodeSafeResumePoint(encodeSafeResumePoint(point))
    expect(restored.evidence?.activeAttemptId).toBe('l3-listen-attempt-1')
    expect(restored.evidence?.stimulusExposed).toBe(true)
    expect(restored.evidence?.provenance).toBe('first-attempt')
  })

  it('preserves Help provenance instead of silently restoring an independent attempt', () => {
    const first = recordResponse(
      exposeEvidenceStimulus(createEvidenceRecord(), 'attempt-1'),
      'incorrect',
    )
    const helped = recordHelp(first, 'mapping-specific')
    const point = createSafeResumePoint({
      lessonId: 'lesson-3',
      checkpointId: 'l3-after-help',
      boundary: 'after-help',
      evidence: helped,
    })

    const restored = decodeSafeResumePoint(encodeSafeResumePoint(point))
    expect(restored.evidence?.helpUsed).toBe(true)
    expect(restored.evidence?.helpLevel).toBe('mapping-specific')
    expect(restored.evidence?.provenance).toBe('help-used')
  })

  it('preserves answer-bearing recovery provenance across resume', () => {
    const first = recordResponse(
      exposeEvidenceStimulus(createEvidenceRecord(), 'attempt-1'),
      'incorrect',
    )
    const recovered = recordAnswerBearingRecovery(first)
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

  it('preserves an exact partial orthographic build when safe', () => {
    const contract = MODULE1_CONSTRUCTION_CONTRACTS['l3-w2-reduced']
    let construction = createConstructionState(contract)
    construction = appendConstructionGrapheme(construction, contract, 'Б')
    construction = appendConstructionGrapheme(construction, contract, 'у')

    const point = createSafeResumePoint({
      lessonId: 'lesson-3',
      checkpointId: 'l3-partial-build',
      boundary: 'active-attempt',
      evidence: exposeEvidenceStimulus(
        createEvidenceRecord(),
        'l3-build-attempt-1',
      ),
      localState: {
        kind: 'orthographic-construction',
        restoration: 'exact',
        construction,
      },
    })

    const restored = decodeSafeResumePoint(encodeSafeResumePoint(point))
    expect(restored.localState).toEqual({
      kind: 'orthographic-construction',
      restoration: 'exact',
      construction,
    })
  })

  it('supports clearing only the local build while preserving attempt provenance', () => {
    const contract = MODULE1_CONSTRUCTION_CONTRACTS['l4-w1-low-support']
    const point = createSafeResumePoint({
      lessonId: 'lesson-4',
      checkpointId: 'l4-reset-local-build',
      boundary: 'active-attempt',
      evidence: exposeEvidenceStimulus(
        createEvidenceRecord(),
        'l4-build-attempt-1',
      ),
      localState: {
        kind: 'orthographic-construction',
        restoration: 'reset-local-preserve-attempt',
        construction: createConstructionState(contract),
      },
    })

    const restored = decodeSafeResumePoint(encodeSafeResumePoint(point))
    expect(restored.evidence?.activeAttemptId).toBe('l4-build-attempt-1')
    expect(restored.localState.kind).toBe('orthographic-construction')
  })

  it('rejects resume points that would erase Help/recovery state', () => {
    const first = recordResponse(
      exposeEvidenceStimulus(createEvidenceRecord(), 'attempt-1'),
      'incorrect',
    )
    const helped = recordHelp(first)

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
