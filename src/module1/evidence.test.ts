import { describe, expect, it } from 'vitest'
import {
  completeEvidence,
  createEvidenceRecord,
  recordAnswerBearingRecovery,
  recordAttempt,
  recordHelp,
  recordSupportedRecovery,
} from './evidence'

describe('Module-1 evidence provenance', () => {
  it('distinguishes first attempt from retry without Help', () => {
    const first = recordAttempt(createEvidenceRecord())
    const retry = recordAttempt(first)

    expect(first.provenance).toBe('first-attempt')
    expect(first.attemptCount).toBe(1)
    expect(retry.provenance).toBe('retry-without-help')
    expect(retry.attemptCount).toBe(2)
  })

  it('preserves Help provenance on later attempts', () => {
    const helped = recordHelp(recordAttempt(createEvidenceRecord()))
    const afterHelpAttempt = recordAttempt(helped)

    expect(helped.provenance).toBe('help-used')
    expect(afterHelpAttempt.provenance).toBe('help-used')
    expect(afterHelpAttempt.helpUsed).toBe(true)
  })

  it('distinguishes supported and answer-bearing recovery', () => {
    const supported = recordSupportedRecovery(recordAttempt(createEvidenceRecord()))
    const answerBearing = recordAnswerBearingRecovery(supported)

    expect(supported.provenance).toBe('supported-recovery')
    expect(supported.supportedRecoveryUsed).toBe(true)
    expect(answerBearing.provenance).toBe('answer-bearing-recovery')
    expect(answerBearing.answerBearingRecoveryUsed).toBe(true)
  })

  it('allows completion after recovery without erasing how success was reached', () => {
    const recovered = recordAttempt(
      recordAnswerBearingRecovery(recordAttempt(createEvidenceRecord())),
    )
    const completed = completeEvidence(recovered)

    expect(completed.provenance).toBe('completed')
    expect(completed.completedFrom).toBe('answer-bearing-recovery')
    expect(completed.answerBearingRecoveryUsed).toBe(true)
  })

  it('does not allow evidence to complete without any attempt or recovery action', () => {
    expect(() => completeEvidence(createEvidenceRecord())).toThrow(
      'Evidence cannot complete before an attempt or recovery action.',
    )
  })
})
