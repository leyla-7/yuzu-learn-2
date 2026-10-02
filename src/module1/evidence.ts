export type EvidenceProvenance =
  | 'not-attempted'
  | 'first-attempt'
  | 'retry-without-help'
  | 'help-used'
  | 'supported-recovery'
  | 'answer-bearing-recovery'
  | 'completed'

export type EvidenceCompletionSource = Exclude<
  EvidenceProvenance,
  'not-attempted' | 'completed'
>

export type HelpSupportLevel =
  | 'task-orientation'
  | 'replay-context'
  | 'mapping-specific'
  | 'supported-review'
  | 'full-answer'

export interface EvidenceRecord {
  provenance: EvidenceProvenance
  attemptCount: number
  activeAttemptId: string | null
  stimulusExposed: boolean
  replayCount: number
  helpUsed: boolean
  helpLevel: HelpSupportLevel | null
  supportedRecoveryUsed: boolean
  answerBearingRecoveryUsed: boolean
  completedFrom: EvidenceCompletionSource | null
}

export function createEvidenceRecord(): EvidenceRecord {
  return {
    provenance: 'not-attempted',
    attemptCount: 0,
    activeAttemptId: null,
    stimulusExposed: false,
    replayCount: 0,
    helpUsed: false,
    helpLevel: null,
    supportedRecoveryUsed: false,
    answerBearingRecoveryUsed: false,
    completedFrom: null,
  }
}

function classificationForNextAttempt(record: EvidenceRecord): EvidenceProvenance {
  if (record.answerBearingRecoveryUsed) return 'answer-bearing-recovery'
  if (record.supportedRecoveryUsed) return 'supported-recovery'
  if (record.helpUsed) return 'help-used'
  if (record.attemptCount === 0) return 'first-attempt'
  return 'retry-without-help'
}

export function exposeEvidenceStimulus(
  record: EvidenceRecord,
  attemptId: string,
): EvidenceRecord {
  if (record.provenance === 'completed') {
    throw new Error('Completed evidence cannot start another canonical attempt.')
  }
  if (!attemptId.trim()) {
    throw new Error('Evidence attempt id is required.')
  }
  if (record.stimulusExposed) {
    if (record.activeAttemptId === attemptId) return record
    throw new Error('A different evidence attempt is already active.')
  }

  return {
    ...record,
    provenance: classificationForNextAttempt(record),
    attemptCount: record.attemptCount + 1,
    activeAttemptId: attemptId,
    stimulusExposed: true,
    replayCount: 0,
  }
}

export function recordResponse(record: EvidenceRecord): EvidenceRecord {
  if (!record.stimulusExposed || !record.activeAttemptId) {
    throw new Error('A learner response requires an active evidence stimulus.')
  }

  return {
    ...record,
    stimulusExposed: false,
  }
}

export function recordReplay(record: EvidenceRecord): EvidenceRecord {
  if (!record.stimulusExposed) {
    throw new Error('Replay can only be recorded while a stimulus is active.')
  }

  return {
    ...record,
    replayCount: record.replayCount + 1,
  }
}

export function recordHelp(
  record: EvidenceRecord,
  level: HelpSupportLevel = 'task-orientation',
): EvidenceRecord {
  if (record.provenance === 'completed') {
    throw new Error('Completed evidence cannot enter Help.')
  }

  return {
    ...record,
    provenance: 'help-used',
    helpUsed: true,
    helpLevel: level,
  }
}

export function recordSupportedRecovery(record: EvidenceRecord): EvidenceRecord {
  if (record.provenance === 'completed') {
    throw new Error('Completed evidence cannot enter supported recovery.')
  }

  return {
    ...record,
    provenance: 'supported-recovery',
    helpUsed: true,
    helpLevel: 'supported-review',
    supportedRecoveryUsed: true,
  }
}

export function recordAnswerBearingRecovery(
  record: EvidenceRecord,
): EvidenceRecord {
  if (record.provenance === 'completed') {
    throw new Error('Completed evidence cannot enter answer-bearing recovery.')
  }

  return {
    ...record,
    provenance: 'answer-bearing-recovery',
    helpUsed: true,
    helpLevel: 'full-answer',
    supportedRecoveryUsed: true,
    answerBearingRecoveryUsed: true,
  }
}

export function completeEvidence(record: EvidenceRecord): EvidenceRecord {
  if (record.provenance === 'not-attempted') {
    throw new Error('Evidence cannot complete before an attempt or recovery action.')
  }
  if (record.provenance === 'completed') return record

  return {
    ...record,
    provenance: 'completed',
    stimulusExposed: false,
    completedFrom: record.provenance,
  }
}
