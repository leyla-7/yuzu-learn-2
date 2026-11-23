import { describe, expect, it } from 'vitest'
import {
  completeCurrentEpisode,
  createInitialLesson1State,
  recordAccessibleL9Help,
  recordAccessibleL9Reintegration,
  recordVisualL9Attempt,
  recordVisualL9Help,
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
  selectAccessibleL9Component,
  selectL9Route,
  submitAccessibleL9Sequence,
  undoAccessibleL9Component,
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

describe('WORK-YUZU-063 accessible L9-A runtime delta', () => {
  it('keeps visual and accessible L9 routes distinct', () => {
    let state = createInitialLesson1State()
    state = selectL9Route(state, 'accessible')

    expect(state.l9.route).toBe('accessible')
    expect(state.l9.accessible.entered).toBe(true)
    expect(state.l9.visual.cleanReducedSupportReadingSuccess).toBe(false)
  })

  it('builds from six taught graphemes, removes selected instances, and undoes only the last component', () => {
    let state = selectL9Route(createInitialLesson1State(), 'accessible')
    state = selectAccessibleL9Component(state, 'П')
    state = selectAccessibleL9Component(state, 'р')

    expect(state.l9.accessible.currentSequence).toEqual(['П', 'р'])
    expect(state.l9.accessible.remainingComponents).toEqual([
      'и',
      'в',
      'і',
      'т',
    ])

    state = undoAccessibleL9Component(state)
    expect(state.l9.accessible.currentSequence).toEqual(['П'])
    expect(state.l9.accessible.remainingComponents).toContain('р')
    expect(state.l9.accessible.undoUsed).toBe(true)
  })

  it('allows Check only after all six components are placed and records the first complete sequence', () => {
    let state = selectL9Route(createInitialLesson1State(), 'accessible')
    state = selectAccessibleL9Component(state, 'П')
    expect(() => submitAccessibleL9Sequence(state)).toThrow(
      'Accessible L9 sequence is incomplete',
    )

    for (const component of ['р', 'и', 'в', 'і', 'т'] as const) {
      state = selectAccessibleL9Component(state, component)
    }
    state = submitAccessibleL9Sequence(state)

    expect(state.l9.accessible.submittedSequences).toEqual([
      ['П', 'р', 'и', 'в', 'і', 'т'],
    ])
    expect(state.l9.accessible.firstSequenceOutcome).toBe('success')
    expect(state.l9.accessible.reconstructionCompleted).toBe(true)
    expect(state.l9.accessible.evidenceClassification).toBe(
      'independent-first-attempt',
    )
    expect(state.l9.visual.cleanReducedSupportReadingSuccess).toBe(false)
  })

  it('records a full incorrect sequence without position feedback and supports an independent retry', () => {
    let state = selectL9Route(createInitialLesson1State(), 'accessible')
    for (const component of ['П', 'р', 'і', 'в', 'и', 'т'] as const) {
      state = selectAccessibleL9Component(state, component)
    }
    state = submitAccessibleL9Sequence(state)

    expect(state.l9.accessible.firstSequenceOutcome).toBe('failure')
    expect(state.l9.accessible.currentSequence).toEqual([])
    expect(state.l9.accessible.independentRetryCount).toBe(1)

    for (const component of ['П', 'р', 'и', 'в', 'і', 'т'] as const) {
      state = selectAccessibleL9Component(state, component)
    }
    state = submitAccessibleL9Sequence(state)

    expect(state.l9.accessible.evidenceClassification).toBe(
      'independent-retry',
    )
    expect(state.l9.accessible.submittedSequences).toHaveLength(2)
  })

  it('tracks Help levels, targeted reviews, and supported reconstruction classification', () => {
    let state = selectL9Route(createInitialLesson1State(), 'accessible')
    state = recordAccessibleL9Help(state, 'level-1-neutral-review')
    state = recordAccessibleL9Help(state, 'level-2-vowel-contrast')
    state = recordAccessibleL9Help(state, 'level-2-cluster')

    expect(state.l9.accessible.helpOpened).toBe(true)
    expect(state.l9.accessible.helpEvents).toEqual([
      'level-1-neutral-review',
      'level-2-vowel-contrast',
      'level-2-cluster',
    ])
    expect(state.l9.accessible.vowelContrastReviewUsed).toBe(true)
    expect(state.l9.accessible.clusterReviewUsed).toBe(true)
    expect(state.l9.accessible.answerBearingSupportExposed).toBe(false)

    for (const component of ['П', 'р', 'и', 'в', 'і', 'т'] as const) {
      state = selectAccessibleL9Component(state, component)
    }
    state = submitAccessibleL9Sequence(state)
    expect(state.l9.accessible.evidenceClassification).toBe(
      'supported-reconstruction',
    )
  })

  it('classifies answer-bearing recovery separately and never aliases visual reading success', () => {
    let state = selectL9Route(createInitialLesson1State(), 'accessible')
    state = recordAccessibleL9Help(state, 'level-3-answer-reveal')

    for (const component of ['П', 'р', 'и', 'в', 'і', 'т'] as const) {
      state = selectAccessibleL9Component(state, component)
    }
    state = submitAccessibleL9Sequence(state)
    state = recordAccessibleL9Reintegration(state)

    expect(state.l9.accessible.answerBearingSupportExposed).toBe(true)
    expect(state.l9.accessible.evidenceClassification).toBe(
      'answer-revealed-recovery',
    )
    expect(state.l9.accessible.semanticReintegrationCompleted).toBe(true)
    expect(state.l9.visual.cleanReducedSupportReadingSuccess).toBe(false)
  })

  it('preserves shared Lesson completion without converting accessible evidence into visual evidence', () => {
    let state = selectL9Route(createInitialLesson1State(), 'accessible')
    for (const component of ['П', 'р', 'и', 'в', 'і', 'т'] as const) {
      state = selectAccessibleL9Component(state, component)
    }
    state = submitAccessibleL9Sequence(state)
    state = recordAccessibleL9Reintegration(state)
    for (let index = 0; index < 7; index += 1) {
      state = completeCurrentEpisode(state)
    }

    expect(state.lessonCompleted).toBe(true)
    expect(state.l9.sharedLessonCompletionReached).toBe(true)
    expect(state.l9.visual.cleanReducedSupportReadingSuccess).toBe(false)
  })
})


describe('WORK-YUZU-063 standard visual L9 browser evidence', () => {
  it('records the first visual response and independent retry without exposing foil text', () => {
    let state = selectL9Route(createInitialLesson1State(), 'visual')
    state = recordVisualL9Attempt(state, 'l9-f1')
    state = recordVisualL9Attempt(state, 'l9-target')

    expect(state.l9.visual.submittedOptionIds).toEqual(['l9-f1', 'l9-target'])
    expect(state.l9.visual.firstResponseOutcome).toBe('failure')
    expect(state.l9.visual.independentRetryCount).toBe(1)
    expect(state.l9.visual.cleanReducedSupportReadingSuccess).toBe(true)
  })

  it('does not emit clean reduced-support reading success after answer-bearing help', () => {
    let state = selectL9Route(createInitialLesson1State(), 'visual')
    state = recordVisualL9Help(state, true)
    state = recordVisualL9Attempt(state, 'l9-target')

    expect(state.l9.visual.helpUsed).toBe(true)
    expect(state.l9.visual.answerBearingSupportExposed).toBe(true)
    expect(state.l9.visual.cleanReducedSupportReadingSuccess).toBe(false)
  })
})
