import { describe, expect, it } from 'vitest'
import {
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

describe('WORK-YUZU-063 Lesson 1 runtime evidence scaffolding', () => {
  it('starts at the first Product episode with no inferred evidence', () => {
    const state = createInitialLesson1State()

    expect(state.currentEpisode).toBe('episode-1-greeting-happens')
    expect(state.completedEpisodes).toEqual([])
    expect(state.reducedReading.firstAttemptOutcome).toBe('not-attempted')
    expect(state.lessonCompleted).toBe(false)
  })

  it('advances only through the approved episode sequence', () => {
    let state = createInitialLesson1State()

    state = completeCurrentEpisode(state)
    expect(state.currentEpisode).toBe('episode-2-discover-function')

    state = completeCurrentEpisode(state)
    expect(state.currentEpisode).toBe('episode-3-open-word')

    state = completeCurrentEpisode(state)
    expect(state.currentEpisode).toBe('episode-4-difficult-parts')
  })

  it('keeps mapping evidence addressable per required mapping', () => {
    const state = recordMappingAttempt(
      createInitialLesson1State(),
      'y',
      'failure',
    )

    expect(state.mappingEvidence.y.firstAttemptOutcome).toBe('failure')
    expect(state.mappingEvidence.i.firstAttemptOutcome).toBe('not-attempted')
  })

  it('keeps vowel contrast and cluster evidence independent', () => {
    let state = createInitialLesson1State()

    state = recordDifficultPartAttempt(
      state,
      'vowelContrast',
      'success',
    )
    state = recordDifficultPartAttempt(state, 'cluster', 'failure')

    expect(state.difficultParts.vowelContrast.firstAttemptOutcome).toBe('success')
    expect(state.difficultParts.cluster.firstAttemptOutcome).toBe('failure')
  })

  it('tracks supported reconstruction without converting it into unsupported success', () => {
    const state = recordReconstructionAttempt(
      createInitialLesson1State(),
      'success',
      { supportUsed: true },
    )

    expect(state.reconstruction.firstAttemptOutcome).toBe('success')
    expect(state.reconstruction.supportUsed).toBe(true)
    expect(state.reconstruction.supportAssistedSuccess).toBe(true)
  })

  it('preserves the first reduced-reading result after help and recovery', () => {
    let state = createInitialLesson1State()

    state = recordReducedReadingAttempt(state, 'failure')
    state = markReducedReadingHelpUsed(state)
    state = markReducedReadingRecoveryUsed(state)
    state = recordReducedReadingAttempt(state, 'success')

    expect(state.reducedReading.attemptCount).toBe(2)
    expect(state.reducedReading.firstAttemptOutcome).toBe('failure')
    expect(state.reducedReading.latestOutcome).toBe('success')
    expect(state.reducedReading.helpUsed).toBe(true)
    expect(state.reducedReading.recoveryUsed).toBe(true)
    expect(state.reducedReading.supportAssistedSuccess).toBe(true)
  })

  it('records semantic reconnection separately from the reading attempt', () => {
    let state = createInitialLesson1State()

    state = recordReducedReadingAttempt(state, 'success')
    state = recordSemanticReconnection(state, 'failure')

    expect(state.reducedReading.firstAttemptOutcome).toBe('success')
    expect(state.reducedReading.semanticReconnectionOutcome).toBe('failure')
  })

  it('marks Lesson completion separately from any mastery claim', () => {
    let state = createInitialLesson1State()

    for (let index = 0; index < 7; index += 1) {
      state = completeCurrentEpisode(state)
    }

    expect(state.lessonCompleted).toBe(true)
    expect(state.carryForwardReady).toBe(true)
  })
})
