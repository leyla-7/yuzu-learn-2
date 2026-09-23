import {
  LESSON1_EPISODE_IDS,
  LESSON1_MAPPING_IDS,
  type Lesson1EpisodeId,
  type Lesson1MappingId,
} from './contracts'

export type AttemptOutcome = 'not-attempted' | 'success' | 'failure'
export type RetrievalDirection = 'sound-to-grapheme' | 'grapheme-to-sound'
export type HelpClassification =
  | 'task-orientation'
  | 'linguistic-support'
  | 'answer-bearing-reteaching'
export type ReducedReadingHelpTiming =
  | 'before-first-response'
  | 'after-failed-response'
export type RecoveryRoute =
  | 'vowel-contrast'
  | 'cluster'
  | 'individual-mapping'
  | 'guided-reconstruction-general'

export interface HelpEvent {
  classification: HelpClassification
}

export interface AttemptEvidence {
  attemptCount: number
  firstAttemptOutcome: AttemptOutcome
  latestOutcome: AttemptOutcome
  helpEvents: readonly HelpEvent[]
  supportUsed: boolean
  recoveryRoutes: readonly RecoveryRoute[]
  supportAssistedSuccess: boolean
}

export type ReciprocalRetrievalEvidence = Record<
  RetrievalDirection,
  AttemptEvidence
>

export interface ReducedReadingHelpEvent extends HelpEvent {
  timing: ReducedReadingHelpTiming
}

export interface SemanticReconnectionEvidence {
  outcome: AttemptOutcome
  contextualSupportUsed: boolean
  recoveryUsed: boolean
}

export interface ReducedReadingEvidence extends AttemptEvidence {
  firstResponseOutcome: AttemptOutcome
  independentRetryOutcome: AttemptOutcome
  postRecoveryReadingOutcome: AttemptOutcome
  helpEvents: readonly ReducedReadingHelpEvent[]
  semanticReconnection: SemanticReconnectionEvidence
}

export interface Lesson1RuntimeState {
  currentEpisode: Lesson1EpisodeId
  completedEpisodes: readonly Lesson1EpisodeId[]
  mappingEvidence: Record<Lesson1MappingId, ReciprocalRetrievalEvidence>
  difficultParts: {
    vowelContrast: ReciprocalRetrievalEvidence
    cluster: AttemptEvidence
  }
  reconstruction: AttemptEvidence
  reducedReading: ReducedReadingEvidence
  lessonCompleted: boolean
  carryForwardReady: boolean
}

export interface AttemptFlags {
  helpClassification?: HelpClassification
  supportUsed?: boolean
  recoveryRoute?: RecoveryRoute
}

function emptyAttemptEvidence(): AttemptEvidence {
  return {
    attemptCount: 0,
    firstAttemptOutcome: 'not-attempted',
    latestOutcome: 'not-attempted',
    helpEvents: [],
    supportUsed: false,
    recoveryRoutes: [],
    supportAssistedSuccess: false,
  }
}

function emptyReciprocalEvidence(): ReciprocalRetrievalEvidence {
  return {
    'sound-to-grapheme': emptyAttemptEvidence(),
    'grapheme-to-sound': emptyAttemptEvidence(),
  }
}

function isEvidenceAlteringHelp(
  classification: HelpClassification | undefined,
): boolean {
  return (
    classification === 'linguistic-support' ||
    classification === 'answer-bearing-reteaching'
  )
}

function recordAttempt(
  evidence: AttemptEvidence,
  outcome: Exclude<AttemptOutcome, 'not-attempted'>,
  flags: AttemptFlags = {},
): AttemptEvidence {
  const helpEvents = flags.helpClassification
    ? [...evidence.helpEvents, { classification: flags.helpClassification }]
    : evidence.helpEvents
  const supportUsed =
    evidence.supportUsed ||
    flags.supportUsed === true ||
    isEvidenceAlteringHelp(flags.helpClassification)
  const recoveryRoutes = flags.recoveryRoute
    ? [...evidence.recoveryRoutes, flags.recoveryRoute]
    : evidence.recoveryRoutes

  return {
    attemptCount: evidence.attemptCount + 1,
    firstAttemptOutcome:
      evidence.attemptCount === 0 ? outcome : evidence.firstAttemptOutcome,
    latestOutcome: outcome,
    helpEvents,
    supportUsed,
    recoveryRoutes,
    supportAssistedSuccess:
      evidence.supportAssistedSuccess ||
      (outcome === 'success' &&
        (supportUsed || recoveryRoutes.length > 0)),
  }
}

function createMappingEvidence(): Record<
  Lesson1MappingId,
  ReciprocalRetrievalEvidence
> {
  return Object.fromEntries(
    LESSON1_MAPPING_IDS.map((id) => [id, emptyReciprocalEvidence()]),
  ) as Record<Lesson1MappingId, ReciprocalRetrievalEvidence>
}

export function createInitialLesson1State(): Lesson1RuntimeState {
  return {
    currentEpisode: LESSON1_EPISODE_IDS[0],
    completedEpisodes: [],
    mappingEvidence: createMappingEvidence(),
    difficultParts: {
      vowelContrast: emptyReciprocalEvidence(),
      cluster: emptyAttemptEvidence(),
    },
    reconstruction: emptyAttemptEvidence(),
    reducedReading: {
      ...emptyAttemptEvidence(),
      helpEvents: [],
      firstResponseOutcome: 'not-attempted',
      independentRetryOutcome: 'not-attempted',
      postRecoveryReadingOutcome: 'not-attempted',
      semanticReconnection: {
        outcome: 'not-attempted',
        contextualSupportUsed: false,
        recoveryUsed: false,
      },
    },
    lessonCompleted: false,
    carryForwardReady: false,
  }
}

export function recordMappingAttempt(
  state: Lesson1RuntimeState,
  mappingId: Lesson1MappingId,
  direction: RetrievalDirection,
  outcome: Exclude<AttemptOutcome, 'not-attempted'>,
  flags?: AttemptFlags,
): Lesson1RuntimeState {
  return {
    ...state,
    mappingEvidence: {
      ...state.mappingEvidence,
      [mappingId]: {
        ...state.mappingEvidence[mappingId],
        [direction]: recordAttempt(
          state.mappingEvidence[mappingId][direction],
          outcome,
          flags,
        ),
      },
    },
  }
}

export function recordVowelContrastAttempt(
  state: Lesson1RuntimeState,
  direction: RetrievalDirection,
  outcome: Exclude<AttemptOutcome, 'not-attempted'>,
  flags?: AttemptFlags,
): Lesson1RuntimeState {
  return {
    ...state,
    difficultParts: {
      ...state.difficultParts,
      vowelContrast: {
        ...state.difficultParts.vowelContrast,
        [direction]: recordAttempt(
          state.difficultParts.vowelContrast[direction],
          outcome,
          flags,
        ),
      },
    },
  }
}

export function recordClusterAttempt(
  state: Lesson1RuntimeState,
  outcome: Exclude<AttemptOutcome, 'not-attempted'>,
  flags?: AttemptFlags,
): Lesson1RuntimeState {
  return {
    ...state,
    difficultParts: {
      ...state.difficultParts,
      cluster: recordAttempt(state.difficultParts.cluster, outcome, flags),
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

export function recordReducedReadingFirstResponse(
  state: Lesson1RuntimeState,
  outcome: Exclude<AttemptOutcome, 'not-attempted'>,
): Lesson1RuntimeState {
  const evidence = recordAttempt(state.reducedReading, outcome)
  return {
    ...state,
    reducedReading: {
      ...state.reducedReading,
      ...evidence,
      helpEvents: state.reducedReading.helpEvents,
      firstResponseOutcome:
        state.reducedReading.firstResponseOutcome === 'not-attempted'
          ? outcome
          : state.reducedReading.firstResponseOutcome,
    },
  }
}

export function recordReducedReadingIndependentRetry(
  state: Lesson1RuntimeState,
  outcome: Exclude<AttemptOutcome, 'not-attempted'>,
): Lesson1RuntimeState {
  const evidence = recordAttempt(state.reducedReading, outcome)
  return {
    ...state,
    reducedReading: {
      ...state.reducedReading,
      ...evidence,
      helpEvents: state.reducedReading.helpEvents,
      independentRetryOutcome: outcome,
    },
  }
}

export function recordReducedReadingHelp(
  state: Lesson1RuntimeState,
  classification: HelpClassification,
  timing: ReducedReadingHelpTiming,
): Lesson1RuntimeState {
  const supportUsed =
    state.reducedReading.supportUsed || isEvidenceAlteringHelp(classification)
  return {
    ...state,
    reducedReading: {
      ...state.reducedReading,
      helpEvents: [
        ...state.reducedReading.helpEvents,
        { classification, timing },
      ],
      supportUsed,
    },
  }
}

export function recordReducedReadingRecovery(
  state: Lesson1RuntimeState,
  route: RecoveryRoute,
): Lesson1RuntimeState {
  return {
    ...state,
    reducedReading: {
      ...state.reducedReading,
      supportUsed: true,
      recoveryRoutes: [...state.reducedReading.recoveryRoutes, route],
    },
  }
}

export function recordPostRecoveryReading(
  state: Lesson1RuntimeState,
  outcome: Exclude<AttemptOutcome, 'not-attempted'>,
): Lesson1RuntimeState {
  const evidence = recordAttempt(state.reducedReading, outcome, {
    supportUsed: true,
  })
  return {
    ...state,
    reducedReading: {
      ...state.reducedReading,
      ...evidence,
      helpEvents: state.reducedReading.helpEvents,
      postRecoveryReadingOutcome: outcome,
    },
  }
}

export function recordSemanticReconnection(
  state: Lesson1RuntimeState,
  outcome: Exclude<AttemptOutcome, 'not-attempted'>,
  flags: {
    contextualSupportUsed?: boolean
    recoveryUsed?: boolean
  } = {},
): Lesson1RuntimeState {
  return {
    ...state,
    reducedReading: {
      ...state.reducedReading,
      semanticReconnection: {
        outcome,
        contextualSupportUsed: flags.contextualSupportUsed === true,
        recoveryUsed: flags.recoveryUsed === true,
      },
    },
  }
}

export function completeCurrentEpisode(
  state: Lesson1RuntimeState,
): Lesson1RuntimeState {
  if (state.lessonCompleted) return state

  const currentIndex = LESSON1_EPISODE_IDS.indexOf(state.currentEpisode)
  if (currentIndex < 0) throw new Error('Unknown Lesson 1 episode')

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
