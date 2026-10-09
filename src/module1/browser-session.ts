import type { OrthographicConstructionState } from './construction'
import type { EvidenceRecord } from './evidence'
import type {
  Module1CapabilityId,
  Module1LessonId,
  OpportunityLedger,
} from './lesson-contracts'
import { LESSON_STATE_SEQUENCES, type LessonStateId } from './browser-spec'

export interface BrowserLessonSession {
  version: 1
  lessonId: Module1LessonId
  stateId: LessonStateId
  itemIndex: number
  opportunities: OpportunityLedger
  evidenceByKey: Record<string, EvidenceRecord>
  constructionByKey: Record<string, OrthographicConstructionState>
  playedAudioRoles: readonly string[]
  helpDepthByKey: Record<string, number>
  pendingNavigation: {
    stateId: LessonStateId
    itemIndex: number
  } | null
  feedback: {
    key: string
    kind: 'success' | 'retry' | 'support'
    text: string
  } | null
}

export function createBrowserLessonSession(
  lessonId: Module1LessonId,
): BrowserLessonSession {
  const first = LESSON_STATE_SEQUENCES[lessonId][0]
  if (!first) throw new Error(`No browser state sequence for ${lessonId}.`)

  return {
    version: 1,
    lessonId,
    stateId: first.id,
    itemIndex: 0,
    opportunities: {},
    evidenceByKey: {},
    constructionByKey: {},
    playedAudioRoles: [],
    helpDepthByKey: {},
    pendingNavigation: null,
    feedback: null,
  }
}

function isLessonStateForLesson(
  lessonId: Module1LessonId,
  stateId: unknown,
): stateId is LessonStateId {
  return (
    typeof stateId === 'string' &&
    LESSON_STATE_SEQUENCES[lessonId].some((state) => state.id === stateId)
  )
}

function isEvidenceMap(value: unknown): value is Record<string, EvidenceRecord> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function isConstructionMap(
  value: unknown,
): value is Record<string, OrthographicConstructionState> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

export function decodeBrowserLessonSession(
  serialized: string | null,
  lessonId: Module1LessonId,
): BrowserLessonSession {
  if (!serialized) return createBrowserLessonSession(lessonId)

  let parsed: unknown
  try {
    parsed = JSON.parse(serialized)
  } catch {
    return createBrowserLessonSession(lessonId)
  }
  if (!parsed || typeof parsed !== 'object') {
    return createBrowserLessonSession(lessonId)
  }

  const candidate = parsed as Partial<BrowserLessonSession>
  if (
    candidate.version !== 1 ||
    candidate.lessonId !== lessonId ||
    !isLessonStateForLesson(lessonId, candidate.stateId) ||
    typeof candidate.itemIndex !== 'number' ||
    !Number.isInteger(candidate.itemIndex) ||
    candidate.itemIndex < 0 ||
    !candidate.opportunities ||
    typeof candidate.opportunities !== 'object' ||
    !isEvidenceMap(candidate.evidenceByKey) ||
    !isConstructionMap(candidate.constructionByKey) ||
    !Array.isArray(candidate.playedAudioRoles) ||
    !candidate.helpDepthByKey ||
    typeof candidate.helpDepthByKey !== 'object'
  ) {
    return createBrowserLessonSession(lessonId)
  }

  return {
    version: 1,
    lessonId,
    stateId: candidate.stateId,
    itemIndex: candidate.itemIndex,
    opportunities: candidate.opportunities,
    evidenceByKey: candidate.evidenceByKey,
    constructionByKey: candidate.constructionByKey,
    playedAudioRoles: candidate.playedAudioRoles.filter(
      (item): item is string => typeof item === 'string',
    ),
    helpDepthByKey: candidate.helpDepthByKey,
    pendingNavigation:
      candidate.pendingNavigation &&
      typeof candidate.pendingNavigation === 'object' &&
      isLessonStateForLesson(
        lessonId,
        candidate.pendingNavigation.stateId,
      ) &&
      typeof candidate.pendingNavigation.itemIndex === 'number' &&
      Number.isInteger(candidate.pendingNavigation.itemIndex) &&
      candidate.pendingNavigation.itemIndex >= 0
        ? {
            stateId: candidate.pendingNavigation.stateId,
            itemIndex: candidate.pendingNavigation.itemIndex,
          }
        : null,
    feedback:
      candidate.feedback &&
      typeof candidate.feedback === 'object' &&
      typeof candidate.feedback.key === 'string' &&
      typeof candidate.feedback.text === 'string' &&
      (candidate.feedback.kind === 'success' ||
        candidate.feedback.kind === 'retry' ||
        candidate.feedback.kind === 'support')
        ? candidate.feedback
        : null,
  }
}

export function encodeBrowserLessonSession(
  session: BrowserLessonSession,
): string {
  return JSON.stringify(session)
}

export function markBrowserOpportunity(
  session: BrowserLessonSession,
  capability: Module1CapabilityId | null,
): BrowserLessonSession {
  if (!capability) return session
  return {
    ...session,
    opportunities: {
      ...session.opportunities,
      [capability]: 'presented',
    },
  }
}

export function advanceBrowserState(
  session: BrowserLessonSession,
): BrowserLessonSession {
  const sequence = LESSON_STATE_SEQUENCES[session.lessonId]
  const currentIndex = sequence.findIndex((state) => state.id === session.stateId)
  const current = sequence[currentIndex]
  const next = sequence[currentIndex + 1]
  const withOpportunity = markBrowserOpportunity(
    session,
    current?.capability ?? null,
  )
  if (!next) return withOpportunity

  return {
    ...withOpportunity,
    stateId: next.id,
    itemIndex: 0,
    pendingNavigation: null,
    feedback: null,
  }
}

export function setBrowserItem(
  session: BrowserLessonSession,
  itemIndex: number,
): BrowserLessonSession {
  return {
    ...session,
    itemIndex,
    pendingNavigation: null,
    feedback: null,
  }
}

export function recordBrowserAudioPlayed(
  session: BrowserLessonSession,
  role: string,
): BrowserLessonSession {
  if (session.playedAudioRoles.includes(role)) return session
  return {
    ...session,
    playedAudioRoles: [...session.playedAudioRoles, role],
  }
}

export function setBrowserEvidence(
  session: BrowserLessonSession,
  key: string,
  evidence: EvidenceRecord,
): BrowserLessonSession {
  return {
    ...session,
    evidenceByKey: {
      ...session.evidenceByKey,
      [key]: evidence,
    },
  }
}

export function setBrowserConstruction(
  session: BrowserLessonSession,
  key: string,
  construction: OrthographicConstructionState,
): BrowserLessonSession {
  return {
    ...session,
    constructionByKey: {
      ...session.constructionByKey,
      [key]: construction,
    },
  }
}

export function setBrowserHelpDepth(
  session: BrowserLessonSession,
  key: string,
  depth: number,
): BrowserLessonSession {
  return {
    ...session,
    helpDepthByKey: {
      ...session.helpDepthByKey,
      [key]: depth,
    },
  }
}

export function setBrowserFeedback(
  session: BrowserLessonSession,
  feedback: BrowserLessonSession['feedback'],
): BrowserLessonSession {
  return { ...session, feedback }
}

export function stageBrowserNavigation(
  current: BrowserLessonSession,
  target: BrowserLessonSession,
  feedback: NonNullable<BrowserLessonSession['feedback']>,
): BrowserLessonSession {
  const changed =
    target.stateId !== current.stateId ||
    target.itemIndex !== current.itemIndex

  if (!changed) {
    return {
      ...target,
      pendingNavigation: null,
      feedback,
    }
  }

  return {
    ...target,
    stateId: current.stateId,
    itemIndex: current.itemIndex,
    pendingNavigation: {
      stateId: target.stateId,
      itemIndex: target.itemIndex,
    },
    feedback,
  }
}

export function continueBrowserNavigation(
  session: BrowserLessonSession,
): BrowserLessonSession {
  if (!session.pendingNavigation) return session
  return {
    ...session,
    stateId: session.pendingNavigation.stateId,
    itemIndex: session.pendingNavigation.itemIndex,
    pendingNavigation: null,
    feedback: null,
  }
}

export function browserSessionAtState(
  lessonId: Module1LessonId,
  stateId: LessonStateId,
  input?: Partial<Pick<BrowserLessonSession, 'itemIndex' | 'opportunities'>>,
): BrowserLessonSession {
  const session = createBrowserLessonSession(lessonId)
  if (!isLessonStateForLesson(lessonId, stateId)) {
    throw new Error(`${stateId} does not belong to ${lessonId}.`)
  }
  return {
    ...session,
    stateId,
    itemIndex: input?.itemIndex ?? 0,
    opportunities: input?.opportunities ?? {},
  }
}
