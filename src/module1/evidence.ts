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

export type EvidenceResponseOutcome = 'correct' | 'incorrect'

export interface EvidenceResponse {
  attemptId: string
  outcome: EvidenceResponseOutcome
  provenance: Exclude<EvidenceProvenance, 'not-attempted' | 'completed'>
}

export interface HelpEvent {
  level: HelpSupportLevel
  contentId: string | null
}

export interface EvidenceRecord {
  provenance: EvidenceProvenance
  attemptCount: number
  activeAttemptId: string | null
  stimulusExposed: boolean
  replayCount: number
  responses: readonly EvidenceResponse[]
  helpUsed: boolean
  helpLevel: HelpSupportLevel | null
  helpEvents: readonly HelpEvent[]
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
    responses: [],
    helpUsed: false,
    helpLevel: null,
    helpEvents: [],
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
  }
}

export function recordResponse(
  record: EvidenceRecord,
  outcome: EvidenceResponseOutcome,
): EvidenceRecord {
  if (!record.stimulusExposed || !record.activeAttemptId) {
    throw new Error('A learner response requires an active evidence stimulus.')
  }
  if (record.provenance === 'not-attempted' || record.provenance === 'completed') {
    throw new Error('A learner response requires active attempt provenance.')
  }

  return {
    ...record,
    stimulusExposed: false,
    responses: [
      ...record.responses,
      {
        attemptId: record.activeAttemptId,
        outcome,
        provenance: record.provenance,
      },
    ],
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

function appendHelpEvent(
  record: EvidenceRecord,
  level: HelpSupportLevel,
  contentId: string | null,
): readonly HelpEvent[] {
  return [...record.helpEvents, { level, contentId }]
}

export function recordHelp(
  record: EvidenceRecord,
  level: HelpSupportLevel = 'task-orientation',
  contentId: string | null = null,
): EvidenceRecord {
  if (record.provenance === 'completed') {
    throw new Error('Completed evidence cannot enter Help.')
  }

  return {
    ...record,
    provenance: 'help-used',
    helpUsed: true,
    helpLevel: level,
    helpEvents: appendHelpEvent(record, level, contentId),
  }
}

export function recordSupportedRecovery(
  record: EvidenceRecord,
  contentId: string | null = null,
): EvidenceRecord {
  if (record.provenance === 'completed') {
    throw new Error('Completed evidence cannot enter supported recovery.')
  }

  return {
    ...record,
    provenance: 'supported-recovery',
    stimulusExposed: false,
    helpUsed: true,
    helpLevel: 'supported-review',
    helpEvents: appendHelpEvent(record, 'supported-review', contentId),
    supportedRecoveryUsed: true,
  }
}

export function recordAnswerBearingRecovery(
  record: EvidenceRecord,
  contentId: string | null = null,
): EvidenceRecord {
  if (record.provenance === 'completed') {
    throw new Error('Completed evidence cannot enter answer-bearing recovery.')
  }

  return {
    ...record,
    provenance: 'answer-bearing-recovery',
    stimulusExposed: false,
    helpUsed: true,
    helpLevel: 'full-answer',
    helpEvents: appendHelpEvent(record, 'full-answer', contentId),
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
