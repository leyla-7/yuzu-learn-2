import { describe, expect, it } from 'vitest'
import {
  completeEvidence,
  createEvidenceRecord,
  exposeEvidenceStimulus,
  recordAnswerBearingRecovery,
  recordHelp,
  recordReplay,
  recordResponse,
  recordSupportedRecovery,
} from './evidence'

describe('Module-1 evidence provenance', () => {
  it('starts first-attempt provenance when the stimulus is exposed', () => {
    const first = exposeEvidenceStimulus(createEvidenceRecord(), 'attempt-1')

    expect(first.provenance).toBe('first-attempt')
    expect(first.attemptCount).toBe(1)
    expect(first.activeAttemptId).toBe('attempt-1')
    expect(first.stimulusExposed).toBe(true)
  })

  it('preserves the first-attempt result and distinguishes a retry without Help', () => {
    const first = exposeEvidenceStimulus(createEvidenceRecord(), 'attempt-1')
    const afterResponse = recordResponse(first, 'incorrect')
    const retry = exposeEvidenceStimulus(afterResponse, 'attempt-2')

    expect(afterResponse.responses).toEqual([
      {
        attemptId: 'attempt-1',
        outcome: 'incorrect',
        provenance: 'first-attempt',
      },
    ])
    expect(retry.provenance).toBe('retry-without-help')
    expect(retry.attemptCount).toBe(2)
  })

  it('records Replay separately from Help and preserves the count across retries', () => {
    let active = exposeEvidenceStimulus(createEvidenceRecord(), 'listen-1')
    active = recordReplay(active)
    const afterResponse = recordResponse(active, 'incorrect')
    const retry = exposeEvidenceStimulus(afterResponse, 'listen-2')

    expect(retry.replayCount).toBe(1)
    expect(retry.helpUsed).toBe(false)
    expect(retry.provenance).toBe('retry-without-help')
  })

  it('preserves Help level and exact Help content identifiers', () => {
    const first = recordResponse(
      exposeEvidenceStimulus(createEvidenceRecord(), 'attempt-1'),
      'incorrect',
    )
    const helped = recordHelp(
      first,
      'mapping-specific',
      'content:l3:w2:mapping-help',
    )
    const afterHelpAttempt = exposeEvidenceStimulus(helped, 'attempt-2')

    expect(helped.provenance).toBe('help-used')
    expect(helped.helpLevel).toBe('mapping-specific')
    expect(helped.helpEvents).toEqual([
      {
        level: 'mapping-specific',
        contentId: 'content:l3:w2:mapping-help',
      },
    ])
    expect(afterHelpAttempt.provenance).toBe('help-used')
  })

  it('distinguishes supported and answer-bearing recovery and keeps their history', () => {
    const first = recordResponse(
      exposeEvidenceStimulus(createEvidenceRecord(), 'attempt-1'),
      'incorrect',
    )
    const supported = recordSupportedRecovery(first, 'content:supported-review')
    const answerBearing = recordAnswerBearingRecovery(
      supported,
      'content:full-answer',
    )

    expect(supported.provenance).toBe('supported-recovery')
    expect(supported.supportedRecoveryUsed).toBe(true)
    expect(answerBearing.provenance).toBe('answer-bearing-recovery')
    expect(answerBearing.answerBearingRecoveryUsed).toBe(true)
    expect(answerBearing.helpLevel).toBe('full-answer')
    expect(answerBearing.helpEvents).toEqual([
      {
        level: 'supported-review',
        contentId: 'content:supported-review',
      },
      {
        level: 'full-answer',
        contentId: 'content:full-answer',
      },
    ])
  })

  it('allows completion after recovery without erasing how success was reached', () => {
    const first = recordResponse(
      exposeEvidenceStimulus(createEvidenceRecord(), 'attempt-1'),
      'incorrect',
    )
    const recovered = recordAnswerBearingRecovery(first)
    const recoveryAttempt = exposeEvidenceStimulus(recovered, 'attempt-2')
    const completed = completeEvidence(
      recordResponse(recoveryAttempt, 'correct'),
    )

    expect(completed.provenance).toBe('completed')
    expect(completed.completedFrom).toBe('answer-bearing-recovery')
    expect(completed.answerBearingRecoveryUsed).toBe(true)
    expect(completed.responses.at(-1)).toEqual({
      attemptId: 'attempt-2',
      outcome: 'correct',
      provenance: 'answer-bearing-recovery',
    })
  })

  it('does not allow evidence to complete without any attempt or recovery action', () => {
    expect(() => completeEvidence(createEvidenceRecord())).toThrow(
      'Evidence cannot complete before an attempt or recovery action.',
    )
  })
})
