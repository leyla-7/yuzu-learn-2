import type { Module1CapabilityId, Module1LessonId } from './lesson-contracts'

export type LessonStateId =
  | 'l2-s01'
  | 'l2-s02'
  | 'l2-s03'
  | 'l2-s04'
  | 'l2-s05'
  | 'l2-s06'
  | 'l2-s07'
  | 'l3-s01'
  | 'l3-s02'
  | 'l3-s03'
  | 'l3-s04'
  | 'l3-s05'
  | 'l3-s06'
  | 'l4-s01'
  | 'l4-s02'
  | 'l4-s03'
  | 'l4-s04'
  | 'l4-s05'

export type ContextPhase = 'opening' | 'middle' | 'closing'

export interface ContextMoment {
  id: string
  mediaSlot: string
  phase: ContextPhase
  accessibleDescription: string
}

export interface ContextSet {
  id: string
  location: string
  moments: readonly ContextMoment[]
}

export type AudioRole =
  | 'w1-contextual'
  | 'w1-neutral'
  | 'w1-map-p'
  | 'w1-map-r'
  | 'w1-map-y'
  | 'w1-map-v'
  | 'w1-map-i'
  | 'w1-map-t'
  | 'w2-contextual'
  | 'w2-neutral'
  | 'w2-map-b'
  | 'w2-map-u'
  | 'w2-map-a'
  | 'w2-map-j'

export interface AudioBinding {
  role: AudioRole
  status: 'bound-existing-w1' | 'deferred-symbolic-w2'
  src: string | null
  seam: string
}

export const MODULE1_AUDIO_BINDINGS: Readonly<Record<AudioRole, AudioBinding>> = {
  'w1-contextual': {
    role: 'w1-contextual',
    status: 'bound-existing-w1',
    src: '/audio/lesson1/1.m4a',
    seam: 'accepted Lesson-1 contextual Привіт',
  },
  'w1-neutral': {
    role: 'w1-neutral',
    status: 'bound-existing-w1',
    src: '/audio/lesson1/2.m4a',
    seam: 'accepted Lesson-1 neutral Привіт',
  },
  'w1-map-p': {
    role: 'w1-map-p',
    status: 'bound-existing-w1',
    src: '/audio/lesson1/3.m4a',
    seam: 'accepted Lesson-1 П/п mapping',
  },
  'w1-map-r': {
    role: 'w1-map-r',
    status: 'bound-existing-w1',
    src: '/audio/lesson1/4.m4a',
    seam: 'accepted Lesson-1 р mapping',
  },
  'w1-map-y': {
    role: 'w1-map-y',
    status: 'bound-existing-w1',
    src: '/audio/lesson1/5.m4a',
    seam: 'accepted Lesson-1 и mapping',
  },
  'w1-map-v': {
    role: 'w1-map-v',
    status: 'bound-existing-w1',
    src: '/audio/lesson1/6.m4a',
    seam: 'accepted Lesson-1 в mapping',
  },
  'w1-map-i': {
    role: 'w1-map-i',
    status: 'bound-existing-w1',
    src: '/audio/lesson1/7.m4a',
    seam: 'accepted Lesson-1 і mapping',
  },
  'w1-map-t': {
    role: 'w1-map-t',
    status: 'bound-existing-w1',
    src: '/audio/lesson1/8.m4a',
    seam: 'accepted Lesson-1 т mapping',
  },
  'w2-contextual': {
    role: 'w2-contextual',
    status: 'deferred-symbolic-w2',
    src: null,
    seam: 'AUD-M1-L2-W2-CONTEXT-BUVAI',
  },
  'w2-neutral': {
    role: 'w2-neutral',
    status: 'deferred-symbolic-w2',
    src: null,
    seam: 'AUD-M1-W2-NEUTRAL-BUVAI',
  },
  'w2-map-b': {
    role: 'w2-map-b',
    status: 'deferred-symbolic-w2',
    src: null,
    seam: 'MAP-Б',
  },
  'w2-map-u': {
    role: 'w2-map-u',
    status: 'deferred-symbolic-w2',
    src: null,
    seam: 'MAP-у',
  },
  'w2-map-a': {
    role: 'w2-map-a',
    status: 'deferred-symbolic-w2',
    src: null,
    seam: 'MAP-а',
  },
  'w2-map-j': {
    role: 'w2-map-j',
    status: 'deferred-symbolic-w2',
    src: null,
    seam: 'MAP-й',
  },
}

const cinema: ContextSet = {
  id: 'cinema',
  location: 'outside a small cinema',
  moments: [
    {
      id: 'cinema-opening',
      mediaSlot: 'MEDIA-M1-L2-CINEMA-OPENING',
      phase: 'opening',
      accessibleDescription:
        'Two friends notice each other outside a cinema, smile, and begin interacting.',
    },
    {
      id: 'cinema-closing',
      mediaSlot: 'MEDIA-M1-L2-CINEMA-CLOSING',
      phase: 'closing',
      accessibleDescription:
        'Two friends who have spent time together turn toward each other as one prepares to leave.',
    },
  ],
}

const courtyard: ContextSet = {
  id: 'courtyard',
  location: 'apartment courtyard',
  moments: [
    {
      id: 'courtyard-opening',
      mediaSlot: 'MEDIA-M1-L2-COURTYARD-OPENING',
      phase: 'opening',
      accessibleDescription:
        'Two friends recognise each other and begin interacting.',
    },
    {
      id: 'courtyard-middle',
      mediaSlot: 'MEDIA-M1-L2-COURTYARD-MIDDLE',
      phase: 'middle',
      accessibleDescription:
        'The same friends are already together and continuing their activity.',
    },
    {
      id: 'courtyard-closing',
      mediaSlot: 'MEDIA-M1-L2-COURTYARD-CLOSING',
      phase: 'closing',
      accessibleDescription:
        'One friend is leaving and the interaction is ending.',
    },
  ],
}

const park: ContextSet = {
  id: 'park-walk',
  location: 'park path',
  moments: [
    {
      id: 'park-opening',
      mediaSlot: 'MEDIA-M1-L2-PARK-OPENING',
      phase: 'opening',
      accessibleDescription:
        'Two friends recognise each other and begin interacting.',
    },
    {
      id: 'park-middle',
      mediaSlot: 'MEDIA-M1-L2-PARK-MIDDLE',
      phase: 'middle',
      accessibleDescription:
        'The same friends are already together and continuing their activity.',
    },
    {
      id: 'park-closing',
      mediaSlot: 'MEDIA-M1-L2-PARK-CLOSING',
      phase: 'closing',
      accessibleDescription:
        'One friend is leaving and the interaction is ending.',
    },
  ],
}

const riversideWalk: ContextSet = {
  id: 'riverside-walk',
  location: 'entrance to a riverside path',
  moments: [
    {
      id: 'riverside-walk-opening',
      mediaSlot: 'MEDIA-M1-L2-RIVERSIDE-WALK-OPENING',
      phase: 'opening',
      accessibleDescription:
        'A friend arrives; the two friends notice each other and begin interacting.',
    },
    {
      id: 'riverside-walk-middle',
      mediaSlot: 'MEDIA-M1-L2-RIVERSIDE-WALK-MIDDLE',
      phase: 'middle',
      accessibleDescription:
        'The same friends are already walking together.',
    },
    {
      id: 'riverside-walk-closing',
      mediaSlot: 'MEDIA-M1-L2-RIVERSIDE-WALK-CLOSING',
      phase: 'closing',
      accessibleDescription:
        'One friend turns toward a bus stop while the other remains; the interaction is ending.',
    },
  ],
}

const basketball: ContextSet = {
  id: 'basketball-court',
  location: 'outdoor basketball court',
  moments: [
    {
      id: 'basketball-opening',
      mediaSlot: 'MEDIA-M1-L3-BASKETBALL-OPENING',
      phase: 'opening',
      accessibleDescription:
        'A friend reaches the outdoor court; the two friends notice each other and begin interacting.',
    },
    {
      id: 'basketball-middle',
      mediaSlot: 'MEDIA-M1-L3-BASKETBALL-MIDDLE',
      phase: 'middle',
      accessibleDescription:
        'The same friends are already playing together.',
    },
    {
      id: 'basketball-closing',
      mediaSlot: 'MEDIA-M1-L3-BASKETBALL-CLOSING',
      phase: 'closing',
      accessibleDescription:
        'One friend picks up a bag and leaves the court; the interaction is ending.',
    },
  ],
}

const bicycle: ContextSet = {
  id: 'bicycle-meeting',
  location: 'bike rack',
  moments: [
    {
      id: 'bicycle-opening',
      mediaSlot: 'MEDIA-M1-L3-BICYCLE-OPENING',
      phase: 'opening',
      accessibleDescription:
        'One friend arrives at the bike rack; the two friends acknowledge each other and begin their shared activity.',
    },
    {
      id: 'bicycle-middle',
      mediaSlot: 'MEDIA-M1-L3-BICYCLE-MIDDLE',
      phase: 'middle',
      accessibleDescription:
        'The same friends are already preparing the bicycles.',
    },
    {
      id: 'bicycle-closing',
      mediaSlot: 'MEDIA-M1-L3-BICYCLE-CLOSING',
      phase: 'closing',
      accessibleDescription:
        'One friend rides away while the other remains; the interaction is ending.',
    },
  ],
}

const artStudio: ContextSet = {
  id: 'art-studio',
  location: 'community art studio',
  moments: [
    {
      id: 'art-opening',
      mediaSlot: 'MEDIA-M1-L3-ART-STUDIO-OPENING',
      phase: 'opening',
      accessibleDescription:
        'A friend arrives; the two friends notice each other and begin interacting.',
    },
    {
      id: 'art-middle',
      mediaSlot: 'MEDIA-M1-L3-ART-STUDIO-MIDDLE',
      phase: 'middle',
      accessibleDescription:
        'The same friends are already working together.',
    },
    {
      id: 'art-closing',
      mediaSlot: 'MEDIA-M1-L3-ART-STUDIO-CLOSING',
      phase: 'closing',
      accessibleDescription:
        'One friend prepares to leave and the interaction is ending.',
    },
  ],
}

const market: ContextSet = {
  id: 'weekend-market',
  location: 'weekend market',
  moments: [
    {
      id: 'market-opening',
      mediaSlot: 'MEDIA-M1-L4-MARKET-OPENING',
      phase: 'opening',
      accessibleDescription:
        'A friend arrives at the market entrance; the two friends notice each other and begin interacting.',
    },
    {
      id: 'market-middle',
      mediaSlot: 'MEDIA-M1-L4-MARKET-MIDDLE',
      phase: 'middle',
      accessibleDescription:
        'The same friends are already walking through the market together.',
    },
    {
      id: 'market-closing',
      mediaSlot: 'MEDIA-M1-L4-MARKET-CLOSING',
      phase: 'closing',
      accessibleDescription:
        'One friend heads toward a different street and leaves; the interaction is ending.',
    },
  ],
}

const garden: ContextSet = {
  id: 'garden-gate',
  location: 'garden gate',
  moments: [
    {
      id: 'garden-opening',
      mediaSlot: 'MEDIA-M1-L4-GARDEN-OPENING',
      phase: 'opening',
      accessibleDescription:
        'One friend approaches the garden gate; the resident friend notices them and begins interacting.',
    },
    {
      id: 'garden-middle',
      mediaSlot: 'MEDIA-M1-L4-GARDEN-MIDDLE',
      phase: 'middle',
      accessibleDescription:
        'The same friends are already spending time together in the garden.',
    },
    {
      id: 'garden-closing',
      mediaSlot: 'MEDIA-M1-L4-GARDEN-CLOSING',
      phase: 'closing',
      accessibleDescription:
        'The visiting friend returns to the gate with a bag and leaves; the interaction is ending.',
    },
  ],
}

const foodTruck: ContextSet = {
  id: 'food-truck',
  location: 'riverside food-truck area',
  moments: [
    {
      id: 'food-truck-opening',
      mediaSlot: 'MEDIA-M1-L4-FOOD-TRUCK-OPENING',
      phase: 'opening',
      accessibleDescription:
        'A friend arrives; both friends notice each other and begin interacting.',
    },
    {
      id: 'food-truck-middle',
      mediaSlot: 'MEDIA-M1-L4-FOOD-TRUCK-MIDDLE',
      phase: 'middle',
      accessibleDescription:
        'The same friends are already sitting together.',
    },
    {
      id: 'food-truck-closing',
      mediaSlot: 'MEDIA-M1-L4-FOOD-TRUCK-CLOSING',
      phase: 'closing',
      accessibleDescription:
        'One friend has gathered their things and is leaving; the interaction is ending.',
    },
  ],
}

export const MODULE1_CONTEXTS = {
  cinema,
  courtyard,
  park,
  riversideWalk,
  basketball,
  bicycle,
  artStudio,
  market,
  garden,
  foodTruck,
} as const

export interface LessonStateSpec {
  id: LessonStateId
  lessonId: Module1LessonId
  capability: Module1CapabilityId | null
  heading: string
}

export const LESSON_STATE_SEQUENCES: Readonly<
  Record<Module1LessonId, readonly LessonStateSpec[]>
> = {
  'lesson-2': [
    { id: 'l2-s01', lessonId: 'lesson-2', capability: 'w1-changed-context-retrieval', heading: 'Listen. Choose the moment.' },
    { id: 'l2-s02', lessonId: 'lesson-2', capability: 'w2-integrated-encounter', heading: 'Watch and listen.' },
    { id: 'l2-s03', lessonId: 'lesson-2', capability: 'opening-closing-contrast', heading: 'Choose what belongs at this moment.' },
    { id: 'l2-s04', lessonId: 'lesson-2', capability: 'delta-g2-mapping-practice', heading: 'Now work with Бувай.' },
    { id: 'l2-s05', lessonId: 'lesson-2', capability: 'w2-guided-decoding', heading: 'Read. Choose where it belongs.' },
    { id: 'l2-s06', lessonId: 'lesson-2', capability: 'supported-orthographic-construction', heading: 'Listen. Build the word you hear.' },
    { id: 'l2-s07', lessonId: 'lesson-2', capability: 'lower-support-paired-return', heading: 'Choose what belongs when they meet.' },
  ],
  'lesson-3': [
    { id: 'l3-s01', lessonId: 'lesson-3', capability: 'changed-context-w1-w2-retrieval', heading: 'Choose the word that belongs here.' },
    { id: 'l3-s02', lessonId: 'lesson-3', capability: 'listening-without-answer-print', heading: 'Listen. Choose the moment.' },
    { id: 'l3-s03', lessonId: 'lesson-3', capability: 'reading-without-auto-target-audio', heading: 'Read. Choose where it belongs.' },
    { id: 'l3-s04', lessonId: 'lesson-3', capability: 'reduced-support-orthographic-retrieval', heading: 'Build the word that belongs here.' },
    { id: 'l3-s05', lessonId: 'lesson-3', capability: 'integrated-opening-closing-arc', heading: 'Choose what belongs at this moment.' },
    { id: 'l3-s06', lessonId: 'lesson-3', capability: null, heading: 'Lesson complete.' },
  ],
  'lesson-4': [
    { id: 'l4-s01', lessonId: 'lesson-4', capability: 'delayed-fresh-context-listening', heading: 'Listen. Choose the moment.' },
    { id: 'l4-s02', lessonId: 'lesson-4', capability: 'reduced-support-reading-function', heading: 'Read. Choose the moment.' },
    { id: 'l4-s03', lessonId: 'lesson-4', capability: 'module-low-support-orthographic-retrieval', heading: 'Build the word that belongs here.' },
    { id: 'l4-s04', lessonId: 'lesson-4', capability: 'integrated-opening-closing-arc', heading: 'Choose the word that belongs here.' },
    { id: 'l4-s05', lessonId: 'lesson-4', capability: null, heading: 'Lesson complete.' },
  ],
}

export const DEFERRED_W2_AUDIO_SEAMS = [
  'AUD-M1-L2-W2-CONTEXT-BUVAI',
  'AUD-M1-W2-NEUTRAL-BUVAI',
  'MAP-Б',
  'MAP-у',
  'MAP-а',
  'MAP-й',
] as const

export const EXTERNAL_MEDIA_SEAMS = Object.values(MODULE1_CONTEXTS)
  .flatMap((context) => context.moments)
  .map((moment) => moment.mediaSlot)
