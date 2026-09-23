import { describe, expect, it } from 'vitest'
import {
  completeCurrentEpisode,
  createInitialLesson1State,
  recordClusterAttempt,
  recordMappingAttempt,
  recordPostRecoveryReading,
  recordReconstructionAttempt,
  recordReducedReadingFirstResponse,
  recordReducedReadingHelp,
  recordReducedReadingIndependentRetry,
  recordReducedReadingRecovery,
  recordSemanticReconnection,
  recordVowelContrastAttempt,
} from './state'

describe('WORK-YUZU-063 post-UX runtime evidence contracts', () => {
  it('starts with no inferred evidence', () => {
    const state = createInitialLesson1State()
    expect(state.currentEpisode).toBe('episode-1-greeting-happens')
    expect(state.reducedReading.firstResponseOutcome).toBe('not-attempted')
    expect(state.lessonCompleted).toBe(false)
  })

  it('preserves reciprocal retrieval evidence per mapping', () => {
    let state = createInitialLesson1State()
    state = recordMappingAttempt(state, 'y', 'sound-to-grapheme', 'failure')
    state = recordMappingAttempt(state, 'y', 'grapheme-to-sound', 'success')

    expect(
      state.mappingEvidence.y['sound-to-grapheme'].firstAttemptOutcome,
    ).toBe('failure')
    expect(
      state.mappingEvidence.y['grapheme-to-sound'].firstAttemptOutcome,
    ).toBe('success')
  })

  it('preserves both vowel-contrast directions and their support independently', () => {
    let state = createInitialLesson1State()
    state = recordVowelContrastAttempt(
      state,
      'sound-to-grapheme',
      'success',
      { helpClassification: 'linguistic-support' },
    )
    state = recordVowelContrastAttempt(
      state,
      'grapheme-to-sound',
      'failure',
    )

    expect(
      state.difficultParts.vowelContrast['sound-to-grapheme'].supportUsed,
    ).toBe(true)
    expect(
      state.difficultParts.vowelContrast['grapheme-to-sound'].supportUsed,
    ).toBe(false)
  })

  it('does not classify task-orientation help as linguistic support', () => {
    let state = createInitialLesson1State()
    state = recordMappingAttempt(
      state,
      'r',
      'sound-to-grapheme',
      'success',
      { helpClassification: 'task-orientation' },
    )

    const evidence = state.mappingEvidence.r['sound-to-grapheme']
    expect(evidence.helpEvents).toEqual([
      { classification: 'task-orientation' },
    ])
    expect(evidence.supportUsed).toBe(false)
    expect(evidence.supportAssistedSuccess).toBe(false)
  })

  it('preserves recovery route identity', () => {
    let state = createInitialLesson1State()
    state = recordClusterAttempt(state, 'failure', {
      recoveryRoute: 'cluster',
    })
    state = recordReconstructionAttempt(state, 'failure', {
      recoveryRoute: 'guided-reconstruction-general',
    })
    state = recordMappingAttempt(
      state,
      'v',
      'grapheme-to-sound',
      'failure',
      { recoveryRoute: 'individual-mapping' },
    )

    expect(state.difficultParts.cluster.recoveryRoutes).toEqual(['cluster'])
    expect(state.reconstruction.recoveryRoutes).toEqual([
      'guided-reconstruction-general',
    ])
    expect(
      state.mappingEvidence.v['grapheme-to-sound'].recoveryRoutes,
    ).toEqual(['individual-mapping'])
  })

  it('keeps first response, independent retry, help timing and post-recovery reading separate', () => {
    let state = createInitialLesson1State()
    state = recordReducedReadingFirstResponse(state, 'failure')
    state = recordReducedReadingIndependentRetry(state, 'failure')
    state = recordReducedReadingHelp(
      state,
      'answer-bearing-reteaching',
      'after-failed-response',
    )
    state = recordReducedReadingRecovery(state, 'vowel-contrast')
    state = recordPostRecoveryReading(state, 'success')

    expect(state.reducedReading.firstResponseOutcome).toBe('failure')
    expect(state.reducedReading.independentRetryOutcome).toBe('failure')
    expect(state.reducedReading.postRecoveryReadingOutcome).toBe('success')
    expect(state.reducedReading.firstAttemptOutcome).toBe('failure')
    expect(state.reducedReading.helpEvents).toEqual([
      {
        classification: 'answer-bearing-reteaching',
        timing: 'after-failed-response',
      },
    ])
    expect(state.reducedReading.recoveryRoutes).toEqual(['vowel-contrast'])
    expect(state.reducedReading.supportAssistedSuccess).toBe(true)
  })

  it('preserves help before the first response without rewriting its later result', () => {
    let state = createInitialLesson1State()
    state = recordReducedReadingHelp(
      state,
      'linguistic-support',
      'before-first-response',
    )
    state = recordReducedReadingFirstResponse(state, 'success')

    expect(state.reducedReading.firstResponseOutcome).toBe('success')
    expect(state.reducedReading.helpEvents[0]?.timing).toBe(
      'before-first-response',
    )
    expect(state.reducedReading.supportUsed).toBe(true)
  })

  it('keeps semantic reconnection outcome/support distinct from reading evidence', () => {
    let state = createInitialLesson1State()
    state = recordReducedReadingFirstResponse(state, 'success')
    state = recordSemanticReconnection(state, 'failure', {
      contextualSupportUsed: true,
      recoveryUsed: true,
    })

    expect(state.reducedReading.firstResponseOutcome).toBe('success')
    expect(state.reducedReading.semanticReconnection).toEqual({
      outcome: 'failure',
      contextualSupportUsed: true,
      recoveryUsed: true,
    })
  })

  it('marks completion separately from stronger reading/mastery evidence', () => {
    let state = createInitialLesson1State()
    for (let index = 0; index < 7; index += 1) {
      state = completeCurrentEpisode(state)
    }

    expect(state.lessonCompleted).toBe(true)
    expect(state.carryForwardReady).toBe(true)
    expect(state.reducedReading.firstResponseOutcome).toBe('not-attempted')
  })
})
