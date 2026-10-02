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

  it('distinguishes retry without Help after a response', () => {
    const first = exposeEvidenceStimulus(createEvidenceRecord(), 'attempt-1')
    const afterResponse = recordResponse(first)
    const retry = exposeEvidenceStimulus(afterResponse, 'attempt-2')

    expect(retry.provenance).toBe('retry-without-help')
    expect(retry.attemptCount).toBe(2)
  })

  it('records Replay separately from Help', () => {
    const active = exposeEvidenceStimulus(createEvidenceRecord(), 'listen-1')
    const replayed = recordReplay(active)

    expect(replayed.replayCount).toBe(1)
    expect(replayed.helpUsed).toBe(false)
    expect(replayed.provenance).toBe('first-attempt')
  })

  it('preserves Help level and Help provenance on later attempts', () => {
    const first = recordResponse(
      exposeEvidenceStimulus(createEvidenceRecord(), 'attempt-1'),
    )
    const helped = recordHelp(first, 'mapping-specific')
    const afterHelpAttempt = exposeEvidenceStimulus(helped, 'attempt-2')

    expect(helped.provenance).toBe('help-used')
    expect(helped.helpLevel).toBe('mapping-specific')
    expect(afterHelpAttempt.provenance).toBe('help-used')
    expect(afterHelpAttempt.helpUsed).toBe(true)
  })

  it('distinguishes supported and answer-bearing recovery', () => {
    const first = recordResponse(
      exposeEvidenceStimulus(createEvidenceRecord(), 'attempt-1'),
    )
    const supported = recordSupportedRecovery(first)
    const answerBearing = recordAnswerBearingRecovery(supported)

    expect(supported.provenance).toBe('supported-recovery')
    expect(supported.supportedRecoveryUsed).toBe(true)
    expect(answerBearing.provenance).toBe('answer-bearing-recovery')
    expect(answerBearing.answerBearingRecoveryUsed).toBe(true)
    expect(answerBearing.helpLevel).toBe('full-answer')
  })

  it('allows completion after recovery without erasing how success was reached', () => {
    const first = recordResponse(
      exposeEvidenceStimulus(createEvidenceRecord(), 'attempt-1'),
    )
    const recovered = recordAnswerBearingRecovery(first)
    const recoveryAttempt = exposeEvidenceStimulus(recovered, 'attempt-2')
    const completed = completeEvidence(recordResponse(recoveryAttempt))

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
