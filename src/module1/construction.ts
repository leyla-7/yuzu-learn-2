import type { HelpSupportLevel } from './evidence'
import type { Module1LessonId } from './lesson-contracts'
import {
  K2_GRAPHEMES,
  MODULE1_TARGETS,
  type Module1TargetId,
  type Module1TaughtGrapheme,
} from './resources'

export type ConstructionContractId =
  | 'l2-w2-supported'
  | 'l3-w1-reduced'
  | 'l3-w2-reduced'
  | 'l4-w1-low-support'
  | 'l4-w2-low-support'

export type ConstructionPoolMode = 'exact-target' | 'k2-taught-pool'

export interface OrthographicConstructionContract {
  id: ConstructionContractId
  lessonId: Module1LessonId
  targetId: Module1TargetId
  targetLengthSupport: boolean
  poolMode: ConstructionPoolMode
  perPlacementCorrectness: false
  fullSequenceCheck: true
  undoAllowed: true
}

export const MODULE1_CONSTRUCTION_CONTRACTS: Readonly<
  Record<ConstructionContractId, OrthographicConstructionContract>
> = {
  'l2-w2-supported': {
    id: 'l2-w2-supported',
    lessonId: 'lesson-2',
    targetId: 'w2',
    targetLengthSupport: true,
    poolMode: 'exact-target',
    perPlacementCorrectness: false,
    fullSequenceCheck: true,
    undoAllowed: true,
  },
  'l3-w1-reduced': {
    id: 'l3-w1-reduced',
    lessonId: 'lesson-3',
    targetId: 'w1',
    targetLengthSupport: false,
    poolMode: 'k2-taught-pool',
    perPlacementCorrectness: false,
    fullSequenceCheck: true,
    undoAllowed: true,
  },
  'l3-w2-reduced': {
    id: 'l3-w2-reduced',
    lessonId: 'lesson-3',
    targetId: 'w2',
    targetLengthSupport: false,
    poolMode: 'k2-taught-pool',
    perPlacementCorrectness: false,
    fullSequenceCheck: true,
    undoAllowed: true,
  },
  'l4-w1-low-support': {
    id: 'l4-w1-low-support',
    lessonId: 'lesson-4',
    targetId: 'w1',
    targetLengthSupport: false,
    poolMode: 'k2-taught-pool',
    perPlacementCorrectness: false,
    fullSequenceCheck: true,
    undoAllowed: true,
  },
  'l4-w2-low-support': {
    id: 'l4-w2-low-support',
    lessonId: 'lesson-4',
    targetId: 'w2',
    targetLengthSupport: false,
    poolMode: 'k2-taught-pool',
    perPlacementCorrectness: false,
    fullSequenceCheck: true,
    undoAllowed: true,
  },
}

function targetGraphemes(targetId: Module1TargetId): Module1TaughtGrapheme[] {
  return [...MODULE1_TARGETS[targetId].writtenForm] as Module1TaughtGrapheme[]
}

export function getConstructionPool(
  contract: OrthographicConstructionContract,
): readonly Module1TaughtGrapheme[] {
  if (contract.poolMode === 'k2-taught-pool') return K2_GRAPHEMES
  return targetGraphemes(contract.targetId)
}

export interface OrthographicConstructionState {
  contractId: ConstructionContractId
  sequence: readonly Module1TaughtGrapheme[]
  submissionCount: number
  helpLevel: HelpSupportLevel | null
  fullAnswerExposed: boolean
}

export function createConstructionState(
  contract: OrthographicConstructionContract,
): OrthographicConstructionState {
  return {
    contractId: contract.id,
    sequence: [],
    submissionCount: 0,
    helpLevel: null,
    fullAnswerExposed: false,
  }
}

export function appendConstructionGrapheme(
  state: OrthographicConstructionState,
  contract: OrthographicConstructionContract,
  grapheme: Module1TaughtGrapheme,
): OrthographicConstructionState {
  if (!getConstructionPool(contract).includes(grapheme)) {
    throw new Error(`Grapheme ${grapheme} is not available in this construction pool.`)
  }

  return {
    ...state,
    sequence: [...state.sequence, grapheme],
  }
}

export function undoConstructionGrapheme(
  state: OrthographicConstructionState,
): OrthographicConstructionState {
  return {
    ...state,
    sequence: state.sequence.slice(0, -1),
  }
}

export interface ConstructionSubmission {
  correct: boolean
  submittedSequence: string
}

export function submitConstruction(
  state: OrthographicConstructionState,
  contract: OrthographicConstructionContract,
): {
  state: OrthographicConstructionState
  result: ConstructionSubmission
} {
  const submittedSequence = state.sequence.join('')
  const correct =
    submittedSequence === MODULE1_TARGETS[contract.targetId].writtenForm

  return {
    state: {
      ...state,
      submissionCount: state.submissionCount + 1,
    },
    result: {
      correct,
      submittedSequence,
    },
  }
}

export function recordConstructionHelp(
  state: OrthographicConstructionState,
  level: HelpSupportLevel,
): OrthographicConstructionState {
  return {
    ...state,
    helpLevel: level,
    fullAnswerExposed: state.fullAnswerExposed || level === 'full-answer',
  }
}
