export const LESSON1_EPISODE_IDS = [
  'episode-1-greeting-happens',
  'episode-2-discover-function',
  'episode-3-open-word',
  'episode-4-difficult-parts',
  'episode-5-reconstruct',
  'episode-6-reduced-reading',
  'episode-7-close-loop',
] as const

export type Lesson1EpisodeId = (typeof LESSON1_EPISODE_IDS)[number]

export const LESSON1_CONTENT_SLOT_IDS = [
  'C1',
  'C2',
  'C3',
  'C4',
  'C5',
  'C6',
  'C7',
] as const

export type Lesson1ContentSlotId = (typeof LESSON1_CONTENT_SLOT_IDS)[number]

export const LESSON1_MAPPING_IDS = [
  'p-pair',
  'r',
  'y',
  'v',
  'i',
  't',
] as const

export type Lesson1MappingId = (typeof LESSON1_MAPPING_IDS)[number]

export type SpecialistOwner = '13' | '14' | '21' | '22'

export type SpecialistInputKind =
  | 'content'
  | 'context-asset'
  | 'audio'
  | 'interaction'
  | 'presentation'

export interface SpecialistInputRef {
  id: string
  owner: SpecialistOwner
  kind: SpecialistInputKind
  status: 'pending' | 'qualified'
}

export type AudioPurpose =
  | 'target'
  | 'component-mapping'
  | 'vowel-contrast'
  | 'cluster'
  | 'reading-alternatives'

export interface Lesson1AudioRef {
  id: string
  purpose: AudioPurpose
  qualification: 'pending-13' | 'qualified-13'
}

export interface Lesson1TargetContract {
  id: 'privit'
  surface: 'Привіт'
  mappingIds: readonly Lesson1MappingId[]
}

export interface Lesson1EpisodeContract {
  id: Lesson1EpisodeId
  contentSlot: Lesson1ContentSlotId
}

export interface Lesson1ProductionFixture {
  target: Lesson1TargetContract
  episodes: readonly Lesson1EpisodeContract[]
  specialistInputs: readonly SpecialistInputRef[]
  audio: readonly Lesson1AudioRef[]
}

export const LESSON1_PRODUCTION_FIXTURE: Lesson1ProductionFixture = {
  target: {
    id: 'privit',
    surface: 'Привіт',
    mappingIds: LESSON1_MAPPING_IDS,
  },
  episodes: LESSON1_EPISODE_IDS.map((id, index) => ({
    id,
    contentSlot: LESSON1_CONTENT_SLOT_IDS[index]!,
  })),
  specialistInputs: [
    ...LESSON1_CONTENT_SLOT_IDS.map((slot) => ({
      id: `content-${slot}`,
      owner: '14' as const,
      kind: 'content' as const,
      status: 'pending' as const,
    })),
    {
      id: 'context-realization',
      owner: '21',
      kind: 'interaction',
      status: 'pending',
    },
    {
      id: 'ui-realization',
      owner: '22',
      kind: 'presentation',
      status: 'pending',
    },
  ],
  audio: [
    {
      id: 'target-audio',
      purpose: 'target',
      qualification: 'pending-13',
    },
    {
      id: 'component-mapping-audio',
      purpose: 'component-mapping',
      qualification: 'pending-13',
    },
    {
      id: 'vowel-contrast-audio',
      purpose: 'vowel-contrast',
      qualification: 'pending-13',
    },
    {
      id: 'cluster-audio',
      purpose: 'cluster',
      qualification: 'pending-13',
    },
    {
      id: 'reading-alternatives-audio',
      purpose: 'reading-alternatives',
      qualification: 'pending-13',
    },
  ],
}
