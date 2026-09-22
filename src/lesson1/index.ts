export {
  LESSON1_CONTENT_SLOT_IDS,
  LESSON1_EPISODE_IDS,
  LESSON1_MAPPING_IDS,
  LESSON1_PRODUCTION_FIXTURE,
} from './contracts'

export type {
  AudioPurpose,
  Lesson1AudioRef,
  Lesson1ContentSlotId,
  Lesson1EpisodeContract,
  Lesson1EpisodeId,
  Lesson1MappingId,
  Lesson1ProductionFixture,
  Lesson1TargetContract,
  SpecialistInputKind,
  SpecialistInputRef,
  SpecialistOwner,
} from './contracts'

export {
  completeCurrentEpisode,
  createInitialLesson1State,
  markReducedReadingHelpUsed,
  markReducedReadingRecoveryUsed,
  recordDifficultPartAttempt,
  recordMappingAttempt,
  recordReconstructionAttempt,
  recordReducedReadingAttempt,
  recordSemanticReconnection,
} from './state'

export type {
  AttemptEvidence,
  AttemptFlags,
  AttemptOutcome,
  Lesson1RuntimeState,
  ReducedReadingEvidence,
} from './state'
