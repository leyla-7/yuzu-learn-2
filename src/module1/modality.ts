export type EvidenceModality =
  | 'listening'
  | 'reading'
  | 'orthographic-retrieval'
  | 'integrated'

export interface EvidenceExposureState {
  modality: EvidenceModality
  responseCommitted: boolean
  answerBearingPrintVisible: boolean
  answerBearingTargetAudioPlayed: boolean
  completedOrthographicAnswerVisible: boolean
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
    responseCommitted: false,
    answerBearingPrintVisible: false,
    answerBearingTargetAudioPlayed: false,
    completedOrthographicAnswerVisible: false,
  }
}
