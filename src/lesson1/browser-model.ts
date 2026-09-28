import {
  LESSON1_MAPPING_IDS,
  type Lesson1MappingId,
} from './contracts'
import type { RetrievalDirection } from './state'

export const LESSON1_BROWSER_STEPS = [
  'meet',
  'temporal-choice',
  'mapping-practice',
  'vowel-practice',
  'build-read',
  'l9',
  'fresh-context',
  'complete',
] as const

export type Lesson1BrowserStep = (typeof LESSON1_BROWSER_STEPS)[number]

export const LESSON1_AUDIO_ASSETS = {
  contextualTarget: { id: 'audio/contextual-target', status: 'pending-13' },
  neutralTarget: { id: 'audio/neutral-target', status: 'pending-13' },
  p: { id: 'audio/component-p', status: 'pending-13' },
  r: { id: 'audio/component-r', status: 'pending-13' },
  y: { id: 'audio/component-y', status: 'pending-13' },
  v: { id: 'audio/component-v', status: 'pending-13' },
  i: { id: 'audio/component-i', status: 'pending-13' },
  t: { id: 'audio/component-t', status: 'pending-13' },
  beginningPr: { id: 'audio/beginning-pr', status: 'pending-13' },
  l9Target: { id: 'audio/l9-target', status: 'pending-13' },
  l9F1: { id: 'audio/l9-f1', status: 'pending-13' },
  l9F2: { id: 'audio/l9-f2', status: 'pending-13' },
} as const

export type Lesson1AudioAssetId = keyof typeof LESSON1_AUDIO_ASSETS
export type MappingAudioAssetId = 'p' | 'r' | 'y' | 'v' | 'i' | 't'
export type TaughtGrapheme = 'П' | 'п' | 'р' | 'и' | 'в' | 'і' | 'т'

const MAPPING_GRAPHEME: Record<Lesson1MappingId, TaughtGrapheme> = {
  'p-pair': 'П',
  r: 'р',
  y: 'и',
  v: 'в',
  i: 'і',
  t: 'т',
}

const MAPPING_AUDIO: Record<Lesson1MappingId, MappingAudioAssetId> = {
  'p-pair': 'p',
  r: 'r',
  y: 'y',
  v: 'v',
  i: 'i',
  t: 't',
}

export interface MappingPracticeTrial {
  id: string
  mappingId: Lesson1MappingId
  direction: RetrievalDirection
  promptGrapheme?: TaughtGrapheme
  promptAudioId?: MappingAudioAssetId
  graphemeChoices?: readonly TaughtGrapheme[]
  audioChoices?: readonly MappingAudioAssetId[]
  correctGrapheme?: TaughtGrapheme
  correctAudioId?: MappingAudioAssetId
}

function graphemeChoicesFor(mappingId: Lesson1MappingId): readonly TaughtGrapheme[] {
  const target = MAPPING_GRAPHEME[mappingId]
  const pool: TaughtGrapheme[] = ['П', 'р', 'и', 'в', 'і', 'т']
  return [target, ...pool.filter((item) => item !== target).slice(0, 2)]
}

function audioChoicesFor(mappingId: Lesson1MappingId): readonly MappingAudioAssetId[] {
  const target = MAPPING_AUDIO[mappingId]
  const pool: MappingAudioAssetId[] = ['p', 'r', 'y', 'v', 'i', 't']
  return [target, ...pool.filter((item) => item !== target).slice(0, 2)]
}

export function createMappingPractice(): readonly MappingPracticeTrial[] {
  const trials: MappingPracticeTrial[] = []

  for (const mappingId of LESSON1_MAPPING_IDS) {
    const grapheme = MAPPING_GRAPHEME[mappingId]
    const audioId = MAPPING_AUDIO[mappingId]

    trials.push({
      id: `${mappingId}-sound-print`,
      mappingId,
      direction: 'sound-to-grapheme',
      promptAudioId: audioId,
      graphemeChoices: graphemeChoicesFor(mappingId),
      correctGrapheme: grapheme,
    })

    trials.push({
      id: `${mappingId}-print-sound`,
      mappingId,
      direction: 'grapheme-to-sound',
      promptGrapheme: grapheme,
      audioChoices: audioChoicesFor(mappingId),
      correctAudioId: audioId,
    })
  }

  // Lowercase п must be actively encountered without creating a separate mapping.
  trials.splice(1, 0, {
    id: 'p-pair-lowercase-sound-print',
    mappingId: 'p-pair',
    direction: 'sound-to-grapheme',
    promptAudioId: 'p',
    graphemeChoices: ['п', 'т', 'в'],
    correctGrapheme: 'п',
  })

  return trials
}

export function scheduleAdaptiveRetry(
  trials: readonly MappingPracticeTrial[],
  failedTrial: MappingPracticeTrial,
  priorRetries: number,
): readonly MappingPracticeTrial[] {
  if (priorRetries >= 1) return trials
  return [
    ...trials,
    {
      ...failedTrial,
      id: `${failedTrial.id}-retry-${priorRetries + 1}`,
    },
  ]
}

export interface VowelPracticeTrial {
  id: string
  mappingId: 'y' | 'i'
  direction: RetrievalDirection
  grapheme: 'и' | 'і'
  audioId: 'y' | 'i'
  graphemeChoices?: readonly ('и' | 'і')[]
  audioChoices?: readonly ('y' | 'i')[]
}

export function createVowelPractice(): readonly VowelPracticeTrial[] {
  return [
    {
      id: 'y-sound-print',
      mappingId: 'y',
      direction: 'sound-to-grapheme',
      grapheme: 'и',
      audioId: 'y',
      graphemeChoices: ['и', 'і'],
    },
    {
      id: 'i-sound-print',
      mappingId: 'i',
      direction: 'sound-to-grapheme',
      grapheme: 'і',
      audioId: 'i',
      graphemeChoices: ['и', 'і'],
    },
    {
      id: 'y-print-sound',
      mappingId: 'y',
      direction: 'grapheme-to-sound',
      grapheme: 'и',
      audioId: 'y',
      audioChoices: ['y', 'i'],
    },
    {
      id: 'i-print-sound',
      mappingId: 'i',
      direction: 'grapheme-to-sound',
      grapheme: 'і',
      audioId: 'i',
      audioChoices: ['y', 'i'],
    },
  ]
}

export const ACCESSIBLE_L9_HELP_TRIGGERS = {
  vowel: { label: 'и / і' },
  beginning: { label: 'Listen', audioId: 'beginningPr' },
} as const

export const BUILD_PASS_CONFIGS = [
  {
    mode: 'supported',
    allowBeginningSupport: true,
    allowFullTargetReplay: true,
    targetReferenceVisible: true,
    automaticNextCue: false,
  },
  {
    mode: 'reduced',
    allowBeginningSupport: false,
    allowFullTargetReplay: false,
    targetReferenceVisible: false,
    automaticNextCue: false,
  },
] as const

export type VisualL9Option = {
  id: 'l9-target' | 'l9-f1' | 'l9-f2'
  audioId: 'l9Target' | 'l9F1' | 'l9F2'
  correct: boolean
}

export function getVisualL9Options(): readonly VisualL9Option[] {
  return [
    { id: 'l9-target', audioId: 'l9Target', correct: true },
    { id: 'l9-f1', audioId: 'l9F1', correct: false },
    { id: 'l9-f2', audioId: 'l9F2', correct: false },
  ]
}
