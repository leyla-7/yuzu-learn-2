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

export interface EvidenceRecord {
  provenance: EvidenceProvenance
  attemptCount: number
  helpUsed: boolean
  supportedRecoveryUsed: boolean
  answerBearingRecoveryUsed: boolean
  completedFrom: EvidenceCompletionSource | null
}

export function createEvidenceRecord(): EvidenceRecord {
  return {
    provenance: 'not-attempted',
    attemptCount: 0,
    helpUsed: false,
    supportedRecoveryUsed: false,
    answerBearingRecoveryUsed: false,
    completedFrom: null,
  }
}

export function recordAttempt(record: EvidenceRecord): EvidenceRecord {
  if (record.provenance === 'completed') {
    throw new Error('Completed evidence cannot record another canonical attempt.')
  }

  const attemptCount = record.attemptCount + 1
  let provenance: EvidenceProvenance

  if (record.answerBearingRecoveryUsed) {
    provenance = 'answer-bearing-recovery'
  } else if (record.supportedRecoveryUsed) {
    provenance = 'supported-recovery'
  } else if (record.helpUsed) {
    provenance = 'help-used'
  } else if (record.attemptCount === 0) {
    provenance = 'first-attempt'
  } else {
    provenance = 'retry-without-help'
  }

  return {
    ...record,
    provenance,
    attemptCount,
  }
}

export function recordHelp(record: EvidenceRecord): EvidenceRecord {
  if (record.provenance === 'completed') {
    throw new Error('Completed evidence cannot enter Help.')
  }

  return {
    ...record,
    provenance: 'help-used',
    helpUsed: true,
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
    completedFrom: record.provenance,
  }
}
