export type Module1TargetId = 'w1' | 'w2'

export type Module1ResourceSlotKind =
  | 'target-audio'
  | 'mapping-audio'
  | 'mapping-support'
  | 'listening-evidence-audio'
  | 'stress-support'

export type Module1ResourceRequirement =
  | 'required'
  | 'conditional'
  | 'reuse-existing'

export interface Module1ResourceSlot {
  id: string
  kind: Module1ResourceSlotKind
  requirement: Module1ResourceRequirement
  targetId?: Module1TargetId
  grapheme?: Module1TaughtGrapheme
  qualification: 'qualified-binding-required'
}

export interface Module1TargetContract {
  id: Module1TargetId
  writtenForm: 'Привіт' | 'Бувай'
  communicativeFunction: 'opening-familiar-contact' | 'closing-familiar-contact'
  spokenStressReference?: string
}

export const MODULE1_TARGETS: Readonly<Record<Module1TargetId, Module1TargetContract>> = {
  w1: {
    id: 'w1',
    writtenForm: 'Привіт',
    communicativeFunction: 'opening-familiar-contact',
  },
  w2: {
    id: 'w2',
    writtenForm: 'Бувай',
    communicativeFunction: 'closing-familiar-contact',
    spokenStressReference: 'Бува́й',
  },
}

export const K1_GRAPHEMES = ['П', 'п', 'р', 'и', 'в', 'і', 'т'] as const
export const DELTA_G2_GRAPHEMES = ['Б', 'у', 'а', 'й'] as const
export const REUSED_W2_GRAPHEMES = ['в'] as const

export type K1Grapheme = (typeof K1_GRAPHEMES)[number]
export type DeltaG2Grapheme = (typeof DELTA_G2_GRAPHEMES)[number]
export type ReusedW2Grapheme = (typeof REUSED_W2_GRAPHEMES)[number]
export type Module1TaughtGrapheme = K1Grapheme | DeltaG2Grapheme

export const K2_GRAPHEMES: readonly Module1TaughtGrapheme[] = [
  ...K1_GRAPHEMES,
  ...DELTA_G2_GRAPHEMES,
]

export const MODULE1_RESOURCE_SLOTS = {
  w1TargetAudio: {
    id: 'w1.target-audio',
    kind: 'target-audio',
    requirement: 'reuse-existing',
    targetId: 'w1',
    qualification: 'qualified-binding-required',
  },
  w1StressSupport: {
    id: 'w1.stress-support',
    kind: 'stress-support',
    requirement: 'reuse-existing',
    targetId: 'w1',
    qualification: 'qualified-binding-required',
  },
  w1VowelContrastSupport: {
    id: 'w1.vowel-contrast-support',
    kind: 'mapping-support',
    requirement: 'reuse-existing',
    targetId: 'w1',
    qualification: 'qualified-binding-required',
  },
  w2ContextualAudio: {
    id: 'w2.contextual-target-audio',
    kind: 'target-audio',
    requirement: 'required',
    targetId: 'w2',
    qualification: 'qualified-binding-required',
  },
  w2NeutralEvidenceAudio: {
    id: 'w2.neutral-evidence-audio',
    kind: 'listening-evidence-audio',
    requirement: 'required',
    targetId: 'w2',
    qualification: 'qualified-binding-required',
  },
  deltaG2B: {
    id: 'g2.Б.sound-model',
    kind: 'mapping-audio',
    requirement: 'required',
    grapheme: 'Б',
    qualification: 'qualified-binding-required',
  },
  deltaG2U: {
    id: 'g2.у.sound-model',
    kind: 'mapping-audio',
    requirement: 'required',
    grapheme: 'у',
    qualification: 'qualified-binding-required',
  },
  deltaG2A: {
    id: 'g2.а.sound-model',
    kind: 'mapping-audio',
    requirement: 'required',
    grapheme: 'а',
    qualification: 'qualified-binding-required',
  },
  deltaG2J: {
    id: 'g2.й.sound-model',
    kind: 'mapping-audio',
    requirement: 'required',
    grapheme: 'й',
    qualification: 'qualified-binding-required',
  },
  reusedVInW2: {
    id: 'w2.в.context-support',
    kind: 'mapping-support',
    requirement: 'conditional',
    targetId: 'w2',
    grapheme: 'в',
    qualification: 'qualified-binding-required',
  },
  w2SupportBu: {
    id: 'w2.support.Бу',
    kind: 'mapping-support',
    requirement: 'conditional',
    targetId: 'w2',
    qualification: 'qualified-binding-required',
  },
  w2SupportVai: {
    id: 'w2.support.ва́й',
    kind: 'mapping-support',
    requirement: 'conditional',
    targetId: 'w2',
    qualification: 'qualified-binding-required',
  },
  w2SupportAi: {
    id: 'w2.support.ай',
    kind: 'mapping-support',
    requirement: 'conditional',
    targetId: 'w2',
    qualification: 'qualified-binding-required',
  },
  w1ListeningEvidenceAudio: {
    id: 'w1.listening-evidence-audio',
    kind: 'listening-evidence-audio',
    requirement: 'reuse-existing',
    targetId: 'w1',
    qualification: 'qualified-binding-required',
  },
} as const satisfies Record<string, Module1ResourceSlot>

export type Module1ResourceSlotId =
  (typeof MODULE1_RESOURCE_SLOTS)[keyof typeof MODULE1_RESOURCE_SLOTS]['id']

export interface QualifiedResourceBinding {
  slotId: Module1ResourceSlotId
  resourceId: string
}

export function assertValidQualifiedBindings(
  bindings: readonly QualifiedResourceBinding[],
): void {
  const validSlots = new Set<Module1ResourceSlotId>(
    Object.values(MODULE1_RESOURCE_SLOTS).map((slot) => slot.id),
  )
  const seen = new Set<Module1ResourceSlotId>()

  for (const binding of bindings) {
    if (!validSlots.has(binding.slotId)) {
      throw new Error(`Unknown Module-1 resource slot: ${binding.slotId}`)
    }
    if (!binding.resourceId.trim()) {
      throw new Error(`Resource binding for ${binding.slotId} is empty.`)
    }
    if (seen.has(binding.slotId)) {
      throw new Error(`Duplicate Module-1 resource slot binding: ${binding.slotId}`)
    }
    seen.add(binding.slotId)
  }
}

export function getMissingRequiredBindings(
  bindings: readonly QualifiedResourceBinding[],
): Module1ResourceSlotId[] {
  const bound = new Set(bindings.map((binding) => binding.slotId))

  return Object.values(MODULE1_RESOURCE_SLOTS)
    .filter((slot) => slot.requirement === 'required' && !bound.has(slot.id))
    .map((slot) => slot.id)
}
