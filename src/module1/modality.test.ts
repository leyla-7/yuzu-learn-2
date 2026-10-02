import { describe, expect, it } from 'vitest'
import {
  assertEvidenceExposureSafe,
  assertEvidenceReadyForLearnerResponse,
  createProtectedExposure,
  resolveReadingEvidenceRoute,
} from './modality'

describe('Module-1 modality / answer-leakage guards', () => {
  it('creates protected pre-response states for every modality', () => {
    expect(createProtectedExposure('listening')).toEqual({
      modality: 'listening',
      technicalState: 'ready',
      responseCommitted: false,
      answerBearingPrintVisible: false,
      answerBearingTargetAudioPlayed: false,
      completedOrthographicAnswerVisible: false,
    })
  })

  it('blocks answer-bearing print during pre-response listening evidence', () => {
    expect(() =>
      assertEvidenceExposureSafe({
        ...createProtectedExposure('listening'),
        answerBearingPrintVisible: true,
      }),
    ).toThrow('Listening evidence cannot expose answer-bearing print')
  })

  it('blocks target-audio autoplay during pre-response reading evidence', () => {
    expect(() =>
      assertEvidenceExposureSafe({
        ...createProtectedExposure('reading'),
        answerBearingTargetAudioPlayed: true,
      }),
    ).toThrow('Reading evidence cannot autoplay answer-bearing target audio')
  })

  it('blocks completed orthographic answers before retrieval response', () => {
    expect(() =>
      assertEvidenceExposureSafe({
        ...createProtectedExposure('orthographic-retrieval'),
        completedOrthographicAnswerVisible: true,
      }),
    ).toThrow('Orthographic retrieval cannot expose the completed answer')
  })

  it('keeps audio/load failure technical rather than recording a learner response', () => {
    expect(() =>
      assertEvidenceReadyForLearnerResponse({
        ...createProtectedExposure('listening'),
        technicalState: 'load-failed',
      }),
    ).toThrow('Evidence stimulus is not technically ready')
  })

  it('routes AT-answer-bearing print conditions to separate accessible evidence semantics', () => {
    expect(
      resolveReadingEvidenceRoute({
        assistivePresentationWouldVocalizeFullTarget: true,
      }),
    ).toEqual({
      route: 'accessible-orthographic-mapping',
      evidenceSemantic: 'accessible-orthographic-mapping-reintegration',
    })

    expect(
      resolveReadingEvidenceRoute({
        assistivePresentationWouldVocalizeFullTarget: false,
      }),
    ).toEqual({
      route: 'visual-reading',
      evidenceSemantic: 'reduced-support-visual-reading',
    })
  })

  it('allows answer-bearing reintegration after the response is committed', () => {
    expect(() =>
      assertEvidenceExposureSafe({
        modality: 'integrated',
        technicalState: 'ready',
        responseCommitted: true,
        answerBearingPrintVisible: true,
        answerBearingTargetAudioPlayed: true,
        completedOrthographicAnswerVisible: true,
      }),
    ).not.toThrow()
  })
})
