import type { LessonCompleteDetail } from '../shell/runtime-contract'
import type { Module1TargetId } from './resources'

export type Module1LessonId = 'lesson-2' | 'lesson-3' | 'lesson-4'

export type Module1CapabilityId =
  | 'w1-changed-context-retrieval'
  | 'w2-integrated-encounter'
  | 'delta-g2-mapping-practice'
  | 'reused-v-context'
  | 'w2-guided-decoding'
  | 'opening-closing-contrast'
  | 'supported-orthographic-construction'
  | 'lower-support-paired-return'
  | 'changed-context-w1-w2-retrieval'
  | 'listening-without-answer-print'
  | 'reading-without-auto-target-audio'
  | 'embedded-k2-renewal'
  | 'reduced-support-orthographic-retrieval'
  | 'help-recovery-provenance'
  | 'integrated-opening-closing-arc'
  | 'delayed-fresh-context-listening'
  | 'reduced-support-reading-function'
  | 'module-low-support-orthographic-retrieval'
  | 'fresh-function-retrieval'

export interface Module1LessonRuntimeContract {
  lessonId: Module1LessonId
  targetIds: readonly Module1TargetId[]
  requiredCapabilities: readonly Module1CapabilityId[]
  completionOpportunities: readonly Module1CapabilityId[]
  emitsModuleCompletionUpdate: boolean
}

export const MODULE1_LESSON_RUNTIME_CONTRACTS: Readonly<
  Record<Module1LessonId, Module1LessonRuntimeContract>
> = {
  'lesson-2': {
    lessonId: 'lesson-2',
    targetIds: ['w1', 'w2'],
    requiredCapabilities: [
      'w1-changed-context-retrieval',
      'w2-integrated-encounter',
      'delta-g2-mapping-practice',
      'reused-v-context',
      'w2-guided-decoding',
      'opening-closing-contrast',
      'supported-orthographic-construction',
      'lower-support-paired-return',
      'help-recovery-provenance',
    ],
    completionOpportunities: [
      'w1-changed-context-retrieval',
      'w2-integrated-encounter',
      'delta-g2-mapping-practice',
      'w2-guided-decoding',
      'opening-closing-contrast',
      'supported-orthographic-construction',
    ],
    emitsModuleCompletionUpdate: false,
  },
  'lesson-3': {
    lessonId: 'lesson-3',
    targetIds: ['w1', 'w2'],
    requiredCapabilities: [
      'changed-context-w1-w2-retrieval',
      'listening-without-answer-print',
      'reading-without-auto-target-audio',
      'embedded-k2-renewal',
      'reduced-support-orthographic-retrieval',
      'help-recovery-provenance',
      'integrated-opening-closing-arc',
    ],
    completionOpportunities: [
      'changed-context-w1-w2-retrieval',
      'listening-without-answer-print',
      'reading-without-auto-target-audio',
      'embedded-k2-renewal',
      'reduced-support-orthographic-retrieval',
      'integrated-opening-closing-arc',
    ],
    emitsModuleCompletionUpdate: false,
  },
  'lesson-4': {
    lessonId: 'lesson-4',
    targetIds: ['w1', 'w2'],
    requiredCapabilities: [
      'fresh-function-retrieval',
      'delayed-fresh-context-listening',
      'reduced-support-reading-function',
      'module-low-support-orthographic-retrieval',
      'integrated-opening-closing-arc',
      'help-recovery-provenance',
    ],
    completionOpportunities: [
      'fresh-function-retrieval',
      'delayed-fresh-context-listening',
      'reduced-support-reading-function',
      'module-low-support-orthographic-retrieval',
      'integrated-opening-closing-arc',
    ],
    emitsModuleCompletionUpdate: true,
  },
}

export type OpportunityState = 'not-presented' | 'presented'

export type OpportunityLedger = Partial<
  Record<Module1CapabilityId, OpportunityState>
>

export function markOpportunityPresented(
  ledger: OpportunityLedger,
  opportunity: Module1CapabilityId,
): OpportunityLedger {
  return {
    ...ledger,
    [opportunity]: 'presented',
  }
}

export function canEmitLessonComplete(
  contract: Module1LessonRuntimeContract,
  ledger: OpportunityLedger,
): boolean {
  return contract.completionOpportunities.every(
    (opportunity) => ledger[opportunity] === 'presented',
  )
}

export function createLessonCompleteDetail(
  contract: Module1LessonRuntimeContract,
  ledger: OpportunityLedger,
): LessonCompleteDetail {
  if (!canEmitLessonComplete(contract, ledger)) {
    throw new Error(
      `${contract.lessonId} cannot emit completion before all required opportunities were presented.`,
    )
  }

  return { lessonId: contract.lessonId }
}

export interface Module1LessonCompletionState {
  'lesson-1': boolean
  'lesson-2': boolean
  'lesson-3': boolean
  'lesson-4': boolean
}

export interface Module1CompletionUpdate {
  moduleId: 'module-1'
  complete: true
  completedLessonIds: readonly ['lesson-1', 'lesson-2', 'lesson-3', 'lesson-4']
}

export function createModule1CompletionUpdate(
  state: Module1LessonCompletionState,
): Module1CompletionUpdate | null {
  if (
    !state['lesson-1'] ||
    !state['lesson-2'] ||
    !state['lesson-3'] ||
    !state['lesson-4']
  ) {
    return null
  }

  return {
    moduleId: 'module-1',
    complete: true,
    completedLessonIds: ['lesson-1', 'lesson-2', 'lesson-3', 'lesson-4'],
  }
}
