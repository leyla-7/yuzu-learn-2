import {
  LESSON1_EPISODE_IDS,
  LESSON1_MAPPING_IDS,
  type Lesson1EpisodeId,
  type Lesson1MappingId,
} from './contracts'

export type AttemptOutcome = 'not-attempted' | 'success' | 'failure'

export interface AttemptEvidence {
  attemptCount: number
  firstAttemptOutcome: AttemptOutcome
  latestOutcome: AttemptOutcome
  helpUsed: boolean
  supportUsed: boolean
  recoveryUsed: boolean
  supportAssistedSuccess: boolean
}

export interface ReducedReadingEvidence extends AttemptEvidence {
  semanticReconnectionOutcome: AttemptOutcome
}

export interface Lesson1RuntimeState {
  currentEpisode: Lesson1EpisodeId
  completedEpisodes: readonly Lesson1EpisodeId[]
  mappingEvidence: Record<Lesson1MappingId, AttemptEvidence>
  difficultParts: {
    vowelContrast: AttemptEvidence
    cluster: AttemptEvidence
  }
  reconstruction: AttemptEvidence
  reducedReading: ReducedReadingEvidence
  lessonCompleted: boolean
  carryForwardReady: boolean
}

export interface AttemptFlags {
  helpUsed?: boolean
  supportUsed?: boolean
  recoveryUsed?: boolean
}

function emptyAttemptEvidence(): AttemptEvidence {
  return {
    attemptCount: 0,
    firstAttemptOutcome: 'not-attempted',
    latestOutcome: 'not-attempted',
    helpUsed: false,
    supportUsed: false,
    recoveryUsed: false,
    supportAssistedSuccess: false,
  }
}

function recordAttempt(
  evidence: AttemptEvidence,
  outcome: Exclude<AttemptOutcome, 'not-attempted'>,
  flags: AttemptFlags = {},
): AttemptEvidence {
  const helpUsed = evidence.helpUsed || flags.helpUsed === true
  const supportUsed = evidence.supportUsed || flags.supportUsed === true
  const recoveryUsed = evidence.recoveryUsed || flags.recoveryUsed === true

  return {
    attemptCount: evidence.attemptCount + 1,
    firstAttemptOutcome:
      evidence.attemptCount === 0 ? outcome : evidence.firstAttemptOutcome,
    latestOutcome: outcome,
    helpUsed,
    supportUsed,
    recoveryUsed,
    supportAssistedSuccess:
      evidence.supportAssistedSuccess ||
      (outcome === 'success' && (helpUsed || supportUsed || recoveryUsed)),
  }
}

function createMappingEvidence(): Record<Lesson1MappingId, AttemptEvidence> {
  return Object.fromEntries(
    LESSON1_MAPPING_IDS.map((id) => [id, emptyAttemptEvidence()]),
  ) as Record<Lesson1MappingId, AttemptEvidence>
}

export function createInitialLesson1State(): Lesson1RuntimeState {
  return {
    currentEpisode: LESSON1_EPISODE_IDS[0],
    completedEpisodes: [],
    mappingEvidence: createMappingEvidence(),
    difficultParts: {
      vowelContrast: emptyAttemptEvidence(),
      cluster: emptyAttemptEvidence(),
    },
    reconstruction: emptyAttemptEvidence(),
    reducedReading: {
      ...emptyAttemptEvidence(),
      semanticReconnectionOutcome: 'not-attempted',
    },
    lessonCompleted: false,
    carryForwardReady: false,
  }
}

export function recordMappingAttempt(
  state: Lesson1RuntimeState,
  mappingId: Lesson1MappingId,
  outcome: Exclude<AttemptOutcome, 'not-attempted'>,
  flags?: AttemptFlags,
): Lesson1RuntimeState {
  return {
    ...state,
    mappingEvidence: {
      ...state.mappingEvidence,
      [mappingId]: recordAttempt(state.mappingEvidence[mappingId], outcome, flags),
    },
  }
}

export function recordDifficultPartAttempt(
  state: Lesson1RuntimeState,
  part: 'vowelContrast' | 'cluster',
  outcome: Exclude<AttemptOutcome, 'not-attempted'>,
  flags?: AttemptFlags,
): Lesson1RuntimeState {
  return {
    ...state,
    difficultParts: {
      ...state.difficultParts,
      [part]: recordAttempt(state.difficultParts[part], outcome, flags),
    },
  }
}

export function recordReconstructionAttempt(
  state: Lesson1RuntimeState,
  outcome: Exclude<AttemptOutcome, 'not-attempted'>,
  flags?: AttemptFlags,
): Lesson1RuntimeState {
  return {
    ...state,
    reconstruction: recordAttempt(state.reconstruction, outcome, flags),
  }
}

export function recordReducedReadingAttempt(
  state: Lesson1RuntimeState,
  outcome: Exclude<AttemptOutcome, 'not-attempted'>,
  flags?: AttemptFlags,
): Lesson1RuntimeState {
  const nextEvidence = recordAttempt(state.reducedReading, outcome, flags)

  return {
    ...state,
    reducedReading: {
      ...nextEvidence,
      semanticReconnectionOutcome:
        state.reducedReading.semanticReconnectionOutcome,
    },
  }
}

export function markReducedReadingHelpUsed(
  state: Lesson1RuntimeState,
): Lesson1RuntimeState {
  return {
    ...state,
    reducedReading: {
      ...state.reducedReading,
      helpUsed: true,
    },
  }
}

export function markReducedReadingRecoveryUsed(
  state: Lesson1RuntimeState,
): Lesson1RuntimeState {
  return {
    ...state,
    reducedReading: {
      ...state.reducedReading,
      recoveryUsed: true,
      supportUsed: true,
    },
  }
}

export function recordSemanticReconnection(
  state: Lesson1RuntimeState,
  outcome: Exclude<AttemptOutcome, 'not-attempted'>,
): Lesson1RuntimeState {
  return {
    ...state,
    reducedReading: {
      ...state.reducedReading,
      semanticReconnectionOutcome: outcome,
    },
  }
}

export function completeCurrentEpisode(
  state: Lesson1RuntimeState,
): Lesson1RuntimeState {
  if (state.lessonCompleted) {
    return state
  }

  const currentIndex = LESSON1_EPISODE_IDS.indexOf(state.currentEpisode)

  if (currentIndex < 0) {
    throw new Error('Unknown Lesson 1 episode')
  }

  const completedEpisodes = [...state.completedEpisodes, state.currentEpisode]
  const nextEpisode = LESSON1_EPISODE_IDS[currentIndex + 1]

  if (nextEpisode === undefined) {
    return {
      ...state,
      completedEpisodes,
      lessonCompleted: true,
      carryForwardReady: true,
    }
  }

  return {
    ...state,
    currentEpisode: nextEpisode,
    completedEpisodes,
  }
}
