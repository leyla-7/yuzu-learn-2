export type EvidenceModality =
  | 'listening'
  | 'reading'
  | 'orthographic-retrieval'
  | 'integrated'

export type EvidenceTechnicalState = 'ready' | 'loading' | 'load-failed'

export type ReadingEvidenceRoute =
  | {
      route: 'visual-reading'
      evidenceSemantic: 'reduced-support-visual-reading'
    }
  | {
      route: 'accessible-orthographic-mapping'
      evidenceSemantic: 'accessible-orthographic-mapping-reintegration'
    }

export interface EvidenceExposureState {
  modality: EvidenceModality
  technicalState: EvidenceTechnicalState
  responseCommitted: boolean
  answerBearingPrintVisible: boolean
  answerBearingTargetAudioPlayed: boolean
  completedOrthographicAnswerVisible: boolean
}

export function assertEvidenceReadyForLearnerResponse(
  exposure: EvidenceExposureState,
): void {
  if (exposure.technicalState !== 'ready') {
    throw new Error(
      'Evidence stimulus is not technically ready; do not record a learner response.',
    )
  }
}

export function assertEvidenceExposureSafe(
  exposure: EvidenceExposureState,
): void {
  if (exposure.responseCommitted) return

  if (exposure.modality === 'listening' && exposure.answerBearingPrintVisible) {
    throw new Error(
      'Listening evidence cannot expose answer-bearing print before response.',
    )
  }

  if (exposure.modality === 'reading' && exposure.answerBearingTargetAudioPlayed) {
    throw new Error(
      'Reading evidence cannot autoplay answer-bearing target audio before response.',
    )
  }

  if (
    exposure.modality === 'orthographic-retrieval' &&
    exposure.completedOrthographicAnswerVisible
  ) {
    throw new Error(
      'Orthographic retrieval cannot expose the completed answer before response.',
    )
  }
}

export function createProtectedExposure(
  modality: EvidenceModality,
): EvidenceExposureState {
  return {
    modality,
    technicalState: 'ready',
    responseCommitted: false,
    answerBearingPrintVisible: false,
    answerBearingTargetAudioPlayed: false,
    completedOrthographicAnswerVisible: false,
  }
}

export function resolveReadingEvidenceRoute(input: {
  assistivePresentationWouldVocalizeFullTarget: boolean
}): ReadingEvidenceRoute {
  if (input.assistivePresentationWouldVocalizeFullTarget) {
    return {
      route: 'accessible-orthographic-mapping',
      evidenceSemantic: 'accessible-orthographic-mapping-reintegration',
    }
  }

  return {
    route: 'visual-reading',
    evidenceSemantic: 'reduced-support-visual-reading',
  }
}
