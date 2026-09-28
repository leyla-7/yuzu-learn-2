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

export type L9Route = 'unselected' | 'visual' | 'accessible'
export type VisualL9OptionId = 'l9-target' | 'l9-f1' | 'l9-f2'
export type AccessibleL9Component = 'П' | 'р' | 'и' | 'в' | 'і' | 'т'
export type AccessibleL9HelpType =
  | 'level-1-neutral-review'
  | 'level-2-vowel-contrast'
  | 'level-2-cluster'
  | 'level-3-answer-reveal'
export type AccessibleL9EvidenceClassification =
  | 'not-classified'
  | 'independent-first-attempt'
  | 'independent-retry'
  | 'supported-reconstruction'
  | 'answer-revealed-recovery'

export const ACCESSIBLE_L9_COMPONENTS: readonly AccessibleL9Component[] = [
  'П',
  'р',
  'и',
  'в',
  'і',
  'т',
]

const ACCESSIBLE_L9_TARGET_SEQUENCE = ACCESSIBLE_L9_COMPONENTS

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

export interface AccessibleL9Evidence {
  entered: boolean
  currentSequence: readonly AccessibleL9Component[]
  remainingComponents: readonly AccessibleL9Component[]
  submittedSequences: readonly (readonly AccessibleL9Component[])[]
  firstSequenceOutcome: AttemptOutcome
  undoUsed: boolean
  independentRetryCount: number
  helpOpened: boolean
  helpEvents: readonly AccessibleL9HelpType[]
  vowelContrastReviewUsed: boolean
  clusterReviewUsed: boolean
  answerBearingSupportExposed: boolean
  reconstructionCompleted: boolean
  evidenceClassification: AccessibleL9EvidenceClassification
  semanticReintegrationCompleted: boolean
}

export interface VisualL9Evidence {
  submittedOptionIds: readonly VisualL9OptionId[]
  firstResponseOutcome: AttemptOutcome
  independentRetryCount: number
  helpUsed: boolean
  answerBearingSupportExposed: boolean
  cleanReducedSupportReadingSuccess: boolean
}

export interface L9RuntimeEvidence {
  route: L9Route
  visual: VisualL9Evidence
  accessible: AccessibleL9Evidence
  sharedLessonCompletionReached: boolean
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
  l9: L9RuntimeEvidence
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

function emptyAccessibleL9Evidence(): AccessibleL9Evidence {
  return {
    entered: false,
    currentSequence: [],
    remainingComponents: [...ACCESSIBLE_L9_COMPONENTS],
    submittedSequences: [],
    firstSequenceOutcome: 'not-attempted',
    undoUsed: false,
    independentRetryCount: 0,
    helpOpened: false,
    helpEvents: [],
    vowelContrastReviewUsed: false,
    clusterReviewUsed: false,
    answerBearingSupportExposed: false,
    reconstructionCompleted: false,
    evidenceClassification: 'not-classified',
    semanticReintegrationCompleted: false,
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
      (outcome === 'success' && (supportUsed || recoveryRoutes.length > 0)),
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
    l9: {
      route: 'unselected',
      visual: {
        submittedOptionIds: [],
        firstResponseOutcome: 'not-attempted',
        independentRetryCount: 0,
        helpUsed: false,
        answerBearingSupportExposed: false,
        cleanReducedSupportReadingSuccess: false,
      },
      accessible: emptyAccessibleL9Evidence(),
      sharedLessonCompletionReached: false,
    },
    lessonCompleted: false,
    carryForwardReady: false,
  }
}

export function selectL9Route(
  state: Lesson1RuntimeState,
  route: Exclude<L9Route, 'unselected'>,
): Lesson1RuntimeState {
  if (state.l9.route !== 'unselected' && state.l9.route !== route) {
    throw new Error('L9 route is already selected')
  }

  return {
    ...state,
    l9: {
      ...state.l9,
      route,
      accessible:
        route === 'accessible'
          ? { ...state.l9.accessible, entered: true }
          : state.l9.accessible,
    },
  }
}

function requireVisualL9(state: Lesson1RuntimeState): VisualL9Evidence {
  if (state.l9.route !== 'visual') {
    throw new Error('Visual L9 route is not active')
  }
  return state.l9.visual
}

export function recordVisualL9Help(
  state: Lesson1RuntimeState,
  answerBearing = false,
): Lesson1RuntimeState {
  const visual = requireVisualL9(state)
  return {
    ...state,
    l9: {
      ...state.l9,
      visual: {
        ...visual,
        helpUsed: true,
        answerBearingSupportExposed:
          visual.answerBearingSupportExposed || answerBearing,
        cleanReducedSupportReadingSuccess: false,
      },
    },
  }
}

export function recordVisualL9Attempt(
  state: Lesson1RuntimeState,
  optionId: VisualL9OptionId,
): Lesson1RuntimeState {
  const visual = requireVisualL9(state)
  const success = optionId === 'l9-target'
  const outcome: Exclude<AttemptOutcome, 'not-attempted'> = success
    ? 'success'
    : 'failure'
  const hadPriorAttempt = visual.submittedOptionIds.length > 0

  return {
    ...state,
    l9: {
      ...state.l9,
      visual: {
        ...visual,
        submittedOptionIds: [...visual.submittedOptionIds, optionId],
        firstResponseOutcome:
          visual.firstResponseOutcome === 'not-attempted'
            ? outcome
            : visual.firstResponseOutcome,
        independentRetryCount:
          visual.independentRetryCount + (hadPriorAttempt ? 1 : 0),
        cleanReducedSupportReadingSuccess:
          visual.cleanReducedSupportReadingSuccess ||
          (success &&
            !visual.helpUsed &&
            !visual.answerBearingSupportExposed),
      },
    },
  }
}

function requireAccessibleL9(state: Lesson1RuntimeState): AccessibleL9Evidence {
  if (state.l9.route !== 'accessible' || !state.l9.accessible.entered) {
    throw new Error('Accessible L9 route is not active')
  }
  return state.l9.accessible
}

export function selectAccessibleL9Component(
  state: Lesson1RuntimeState,
  component: AccessibleL9Component,
): Lesson1RuntimeState {
  const accessible = requireAccessibleL9(state)
  if (!accessible.remainingComponents.includes(component)) {
    throw new Error('Accessible L9 component is not available')
  }

  return {
    ...state,
    l9: {
      ...state.l9,
      accessible: {
        ...accessible,
        currentSequence: [...accessible.currentSequence, component],
        remainingComponents: accessible.remainingComponents.filter(
          (candidate) => candidate !== component,
        ),
      },
    },
  }
}

export function undoAccessibleL9Component(
  state: Lesson1RuntimeState,
): Lesson1RuntimeState {
  const accessible = requireAccessibleL9(state)
  const removed = accessible.currentSequence.at(-1)
  if (removed === undefined) return state

  return {
    ...state,
    l9: {
      ...state.l9,
      accessible: {
        ...accessible,
        currentSequence: accessible.currentSequence.slice(0, -1),
        remainingComponents: [...accessible.remainingComponents, removed],
        undoUsed: true,
      },
    },
  }
}

export function recordAccessibleL9Help(
  state: Lesson1RuntimeState,
  helpType: AccessibleL9HelpType,
): Lesson1RuntimeState {
  const accessible = requireAccessibleL9(state)
  return {
    ...state,
    l9: {
      ...state.l9,
      accessible: {
        ...accessible,
        helpOpened: true,
        helpEvents: [...accessible.helpEvents, helpType],
        vowelContrastReviewUsed:
          accessible.vowelContrastReviewUsed ||
          helpType === 'level-2-vowel-contrast',
        clusterReviewUsed:
          accessible.clusterReviewUsed || helpType === 'level-2-cluster',
        answerBearingSupportExposed:
          accessible.answerBearingSupportExposed ||
          helpType === 'level-3-answer-reveal',
      },
    },
  }
}

function sequencesMatch(
  actual: readonly AccessibleL9Component[],
  expected: readonly AccessibleL9Component[],
): boolean {
  return actual.every((component, index) => component === expected[index])
}

function classifyAccessibleL9Success(
  accessible: AccessibleL9Evidence,
): AccessibleL9EvidenceClassification {
  if (accessible.answerBearingSupportExposed) {
    return 'answer-revealed-recovery'
  }
  if (accessible.clusterReviewUsed || accessible.vowelContrastReviewUsed) {
    return 'supported-reconstruction'
  }
  if (accessible.submittedSequences.length > 0) {
    return 'independent-retry'
  }
  return 'independent-first-attempt'
}

export function submitAccessibleL9Sequence(
  state: Lesson1RuntimeState,
): Lesson1RuntimeState {
  const accessible = requireAccessibleL9(state)
  if (accessible.currentSequence.length !== ACCESSIBLE_L9_COMPONENTS.length) {
    throw new Error('Accessible L9 sequence is incomplete')
  }

  const submittedSequence = [...accessible.currentSequence]
  const success = sequencesMatch(
    submittedSequence,
    ACCESSIBLE_L9_TARGET_SEQUENCE,
  )
  const firstSequenceOutcome =
    accessible.firstSequenceOutcome === 'not-attempted'
      ? success
        ? 'success'
        : 'failure'
      : accessible.firstSequenceOutcome

  return {
    ...state,
    l9: {
      ...state.l9,
      accessible: {
        ...accessible,
        currentSequence: success ? submittedSequence : [],
        remainingComponents: success ? [] : [...ACCESSIBLE_L9_COMPONENTS],
        submittedSequences: [
          ...accessible.submittedSequences,
          submittedSequence,
        ],
        firstSequenceOutcome,
        independentRetryCount:
          accessible.independentRetryCount + (success ? 0 : 1),
        reconstructionCompleted: success,
        evidenceClassification: success
          ? classifyAccessibleL9Success(accessible)
          : accessible.evidenceClassification,
      },
    },
  }
}

export function recordAccessibleL9Reintegration(
  state: Lesson1RuntimeState,
): Lesson1RuntimeState {
  const accessible = requireAccessibleL9(state)
  if (!accessible.reconstructionCompleted) {
    throw new Error('Accessible L9 reconstruction is not complete')
  }

  return {
    ...state,
    l9: {
      ...state.l9,
      accessible: {
        ...accessible,
        semanticReintegrationCompleted: true,
      },
    },
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
      l9: {
        ...state.l9,
        sharedLessonCompletionReached: true,
      },
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
