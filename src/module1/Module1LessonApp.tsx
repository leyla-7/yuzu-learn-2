import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import {
  MODULE1_CONSTRUCTION_CONTRACTS,
  appendConstructionGrapheme,
  createConstructionState,
  getConstructionPool,
  recordConstructionHelp,
  submitConstruction,
  undoConstructionGrapheme,
  type ConstructionContractId,
  type OrthographicConstructionContract,
} from './construction'
import {
  completeEvidence,
  createEvidenceRecord,
  exposeEvidenceStimulus,
  recordAnswerBearingRecovery,
  recordHelp,
  recordReplay,
  recordResponse,
  recordSupportedRecovery,
  type EvidenceRecord,
} from './evidence'
import {
  MODULE1_LESSON_RUNTIME_CONTRACTS,
  canEmitLessonComplete,
  markOpportunityPresented,
  type Module1CapabilityId,
  type Module1LessonId,
} from './lesson-contracts'
import {
  DEFERRED_W2_AUDIO_SEAMS,
  LESSON_STATE_SEQUENCES,
  MODULE1_AUDIO_BINDINGS,
  MODULE1_CONTEXTS,
  type AudioRole,
  type ContextMoment,
  type ContextSet,
  type LessonStateId,
} from './browser-spec'
import {
  advanceBrowserState,
  decodeBrowserLessonSession,
  encodeBrowserLessonSession,
  recordBrowserAudioPlayed,
  setBrowserConstruction,
  setBrowserEvidence,
  setBrowserFeedback,
  setBrowserHelpDepth,
  setBrowserItem,
  type BrowserLessonSession,
} from './browser-session'
import {
  LESSON_COMPLETE_EVENT,
  LESSON_SAFE_POINT_EVENT,
} from '../shell/runtime-contract'

const W1 = 'Привіт'
const W2 = 'Бувай'
const W2_MAPPING_ORDER = ['Б', 'у', 'а', 'й', 'в'] as const

const COMPLETION_COPY: Readonly<Record<Module1LessonId, string>> = {
  'lesson-2': 'Lesson complete. Привіт and Бувай will return.',
  'lesson-3': 'Lesson complete. You used the two words again in new situations.',
  'lesson-4':
    'Lesson complete. You worked with Привіт and Бувай again in new situations.',
}

function emitSafePoint(session: BrowserLessonSession) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(
    new CustomEvent(LESSON_SAFE_POINT_EVENT, {
      detail: {
        lessonId: session.lessonId,
        resumePoint: encodeBrowserLessonSession(session),
      },
    }),
  )
}

function emitLessonComplete(lessonId: Module1LessonId) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(
    new CustomEvent(LESSON_COMPLETE_EVENT, {
      detail: { lessonId },
    }),
  )
}

function isModule1LessonId(value: string): value is Module1LessonId {
  return value === 'lesson-2' || value === 'lesson-3' || value === 'lesson-4'
}

function evidenceKey(session: BrowserLessonSession, suffix = 'main') {
  return `${session.stateId}:${session.itemIndex}:${suffix}`
}

function ensureActiveEvidence(
  existing: EvidenceRecord | undefined,
  key: string,
): EvidenceRecord {
  const record = existing ?? createEvidenceRecord()
  if (record.provenance === 'completed') return record
  if (record.stimulusExposed) return record
  return exposeEvidenceStimulus(record, `${key}:attempt-${record.attemptCount + 1}`)
}

function withCapabilities(
  session: BrowserLessonSession,
  capabilities: readonly Module1CapabilityId[],
): BrowserLessonSession {
  return capabilities.reduce(
    (next, capability) => ({
      ...next,
      opportunities: markOpportunityPresented(next.opportunities, capability),
    }),
    session,
  )
}

export function Module1LessonApp({
  lessonId,
  resumePoint,
  useNonvisualAlternatives,
  mode,
}: {
  lessonId: string
  resumePoint: string | null
  useNonvisualAlternatives: boolean
  mode: 'resume' | 'revisit'
}) {
  if (!isModule1LessonId(lessonId)) return null

  return (
    <Module1LessonRuntime
      lessonId={lessonId}
      resumePoint={mode === 'revisit' ? null : resumePoint}
      useNonvisualAlternatives={useNonvisualAlternatives}
    />
  )
}

function Module1LessonRuntime({
  lessonId,
  resumePoint,
  useNonvisualAlternatives,
}: {
  lessonId: Module1LessonId
  resumePoint: string | null
  useNonvisualAlternatives: boolean
}) {
  const [session, setSession] = useState(() =>
    decodeBrowserLessonSession(resumePoint, lessonId),
  )
  const headingRef = useRef<HTMLHeadingElement>(null)
  const feedbackRef = useRef<HTMLDivElement>(null)
  const completionSentRef = useRef(false)

  useEffect(() => {
    emitSafePoint(session)
  }, [session])

  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true })
  }, [session.stateId, session.itemIndex])

  useEffect(() => {
    if (session.feedback) {
      feedbackRef.current?.focus({ preventScroll: true })
    }
  }, [session.feedback])

  const sequence = LESSON_STATE_SEQUENCES[lessonId]
  const stateSpec = sequence.find((state) => state.id === session.stateId)
  if (!stateSpec) return null

  const commit = (next: BrowserLessonSession) => setSession(next)

  const clearFeedback = () =>
    commit(setBrowserFeedback(session, null))

  const recordAudioPlay = (role: AudioRole, evidenceSuffix?: string) => {
    let next = recordBrowserAudioPlayed(session, role)
    if (evidenceSuffix) {
      const key = evidenceKey(next, evidenceSuffix)
      const active = ensureActiveEvidence(next.evidenceByKey[key], key)
      next = setBrowserEvidence(next, key, recordReplay(active))
    }
    commit(next)
  }

  const applyHelp = (
    text: string,
    suffix = 'main',
    supportedText?: string,
    answerText?: string,
  ) => {
    const key = evidenceKey(session, suffix)
    const existing = session.evidenceByKey[key] ?? createEvidenceRecord()
    const depth = session.helpDepthByKey[key] ?? 0
    let evidence: EvidenceRecord
    let message = text
    if (depth === 0) {
      evidence = recordHelp(existing, 'task-orientation', `${key}:help-1`)
    } else if (depth === 1) {
      evidence = recordSupportedRecovery(existing, `${key}:help-2`)
      message = supportedText ?? text
    } else {
      evidence = recordAnswerBearingRecovery(existing, `${key}:help-3`)
      message = answerText ?? supportedText ?? text
    }

    let next = setBrowserEvidence(session, key, evidence)
    next = setBrowserHelpDepth(next, key, depth + 1)
    next = setBrowserFeedback(next, {
      key,
      kind: depth >= 1 ? 'support' : 'retry',
      text: message,
    })
    commit(next)
  }

  const respond = (input: {
    correct: boolean
    successText?: string
    retryText: string
    suffix?: string
    onCorrect: (session: BrowserLessonSession) => BrowserLessonSession
  }) => {
    const suffix = input.suffix ?? 'main'
    const key = evidenceKey(session, suffix)
    const active = ensureActiveEvidence(session.evidenceByKey[key], key)
    const responded = recordResponse(
      active,
      input.correct ? 'correct' : 'incorrect',
    )

    if (!input.correct) {
      let next = setBrowserEvidence(session, key, responded)
      next = setBrowserFeedback(next, {
        key,
        kind: 'retry',
        text: input.retryText,
      })
      commit(next)
      return
    }

    let next = setBrowserEvidence(session, key, completeEvidence(responded))
    next = setBrowserFeedback(next, {
      key,
      kind: 'success',
      text: input.successText ?? 'Yes.',
    })
    next = input.onCorrect(next)
    commit(next)
  }

  const advanceState = (
    current: BrowserLessonSession,
    extraCapabilities: readonly Module1CapabilityId[] = [],
  ) =>
    advanceBrowserState(withCapabilities(current, extraCapabilities))

  const finishIfReady = (current: BrowserLessonSession) => {
    const contract = MODULE1_LESSON_RUNTIME_CONTRACTS[lessonId]
    if (!canEmitLessonComplete(contract, current.opportunities)) return false
    if (!completionSentRef.current) {
      completionSentRef.current = true
      emitLessonComplete(lessonId)
    }
    return true
  }

  const feedback = session.feedback ? (
    <div
      ref={feedbackRef}
      tabIndex={-1}
      className={`lesson-feedback feedback-${session.feedback.kind}`}
      role={session.feedback.kind === 'success' ? 'status' : 'alert'}
      aria-live="polite"
      data-feedback-key={session.feedback.key}
    >
      <strong>{session.feedback.text}</strong>
      {session.feedback.kind !== 'success' ? (
        <button
          className="button secondary-button"
          type="button"
          onClick={clearFeedback}
        >
          Try again
        </button>
      ) : null}
    </div>
  ) : null

  let activity: ReactNode
  switch (stateSpec.id) {
    case 'l2-s01':
      activity = (
        <L2S01
          session={session}
          feedback={feedback}
          onAudio={() => recordAudioPlay('w1-neutral', 'w1-listen')}
          onRespond={(correct) =>
            respond({
              correct,
              retryText: 'Try again. Look at when the interaction begins.',
              suffix: 'w1-listen',
              onCorrect: (next) => setBrowserItem(next, 1),
            })
          }
          onHelp={() =>
            applyHelp(
              'Replay what you learned before, then choose again.',
              'w1-listen',
              'Replay what you learned before, then choose again.',
              W1,
            )
          }
          onRenewal={(choice) => {
            const expected = session.itemIndex === 1 ? 'и' : 'і'
            if (choice !== expected) {
              commit(
                setBrowserFeedback(session, {
                  key: `l2-s01-renewal-${session.itemIndex}`,
                  kind: 'retry',
                  text: 'Try again.',
                }),
              )
              return
            }
            if (session.itemIndex === 1) {
              commit(setBrowserItem(session, 2))
              return
            }
            commit(
              advanceState(
                withCapabilities(session, ['w1-changed-context-retrieval']),
              ),
            )
          }}
        />
      )
      break
    case 'l2-s02':
      activity = (
        <TeachingEncounter
          stateId="l2-s02"
          context={MODULE1_CONTEXTS.cinema}
          visibleTarget={W2}
          audioRole="w2-contextual"
          prompt="Watch and listen."
          support="Notice when the word appears: the time together is ending."
          canContinue={session.playedAudioRoles.includes('w2-contextual')}
          onAudio={() => recordAudioPlay('w2-contextual')}
          onContinue={() =>
            commit(advanceState(withCapabilities(session, ['w2-integrated-encounter'])))
          }
        />
      )
      break
    case 'l2-s03':
      activity = (
        <FunctionPractice
          stateId="l2-s03"
          session={session}
          contexts={[MODULE1_CONTEXTS.courtyard, MODULE1_CONTEXTS.park]}
          feedback={feedback}
          onRespond={(correct) =>
            respond({
              correct,
              retryText:
                'Not this moment. Follow the interaction from the beginning to the end.',
              onCorrect: (next) => {
                if (session.itemIndex === 0) {
                  return setBrowserItem(next, 1)
                }
                return advanceState(
                  withCapabilities(next, ['opening-closing-contrast']),
                )
              },
            })
          }
          onHelp={() =>
            applyHelp(
              'Look for whether contact is starting or ending. Then try again.',
            )
          }
        />
      )
      break
    case 'l2-s04':
      activity = (
        <MappingSequence
          session={session}
          feedback={feedback}
          onAudio={(role) => recordAudioPlay(role, 'mapping')}
          onCorrect={() => {
            if (session.itemIndex < W2_MAPPING_ORDER.length - 1) {
              commit(setBrowserItem(session, session.itemIndex + 1))
            } else {
              commit(
                advanceState(
                  withCapabilities(session, [
                    'delta-g2-mapping-practice',
                    'reused-v-context',
                  ]),
                ),
              )
            }
          }}
          onIncorrect={() =>
            commit(
              setBrowserFeedback(session, {
                key: evidenceKey(session, 'mapping'),
                kind: 'retry',
                text: 'Replay the sound and try again.',
              }),
            )
          }
          onHelp={() =>
            applyHelp(
              'Replay the sound and try again.',
              'mapping',
              'Find that letter in Бувай, replay its sound, then try again.',
            )
          }
        />
      )
      break
    case 'l2-s05':
      activity = useNonvisualAlternatives ? (
        <ConstructionActivity
          session={session}
          contractId="l2-w2-supported"
          cue={
            <StaticContext
              context={MODULE1_CONTEXTS.park}
              phase="closing"
            />
          }
          prompt="Build the word that belongs here."
          feedback={feedback}
          onCommit={commit}
          onComplete={(next) =>
            commit(
              advanceState(withCapabilities(next, ['w2-guided-decoding'])),
            )
          }
          helpCopy="Read from the left. Use the sounds when you need them."
        />
      ) : (
        <ReadingMomentActivity
          stateId="l2-s05"
          session={session}
          target={W2}
          context={MODULE1_CONTEXTS.park}
          phases={['opening', 'closing']}
          feedback={feedback}
          onRespond={(correct) =>
            respond({
              correct,
              retryText: 'Read from the left, then choose.',
              onCorrect: (next) =>
                advanceState(withCapabilities(next, ['w2-guided-decoding'])),
            })
          }
          onHelp={() =>
            applyHelp(
              'Read from the left. Use the sounds when you need them.',
              'main',
              'Read from the left. Use the sounds when you need them.',
            )
          }
        />
      )
      break
    case 'l2-s06':
      activity = (
        <ConstructionActivity
          session={session}
          contractId="l2-w2-supported"
          cue={
            <AudioGate
              role="w2-neutral"
              onPlayed={() => recordAudioPlay('w2-neutral', 'construction')}
              evidenceRequired
            />
          }
          prompt="Listen. Build the word you hear."
          inputReady={session.playedAudioRoles.includes('w2-neutral')}
          feedback={feedback}
          onCommit={commit}
          onComplete={(next) =>
            commit(
              advanceState(
                withCapabilities(next, ['supported-orthographic-construction']),
              ),
            )
          }
          helpCopy="Keep what you have. Check only the part that stopped you."
          supportedHelpCopy="Replay this sound, then place the letter."
          answerHelpCopy="Replay the whole word, then build it again."
        />
      )
      break
    case 'l2-s07':
      activity = (
        <L2S07
          session={session}
          feedback={feedback}
          onAudio={() => recordAudioPlay('w2-neutral', 'closing-listen')}
          onOpening={(correct) =>
            respond({
              correct,
              retryText: 'Try again. Is the interaction beginning or ending?',
              suffix: 'opening',
              onCorrect: (next) => setBrowserItem(next, 1),
            })
          }
          onClosing={(correct) =>
            respond({
              correct,
              retryText: 'Try again. Is the interaction beginning or ending?',
              suffix: 'closing-listen',
              onCorrect: (next) => {
                const completed = withCapabilities(next, [
                  'lower-support-paired-return',
                ])
                finishIfReady(completed)
                return completed
              },
            })
          }
          onHelp={() =>
            applyHelp(
              'Try again. Is the interaction beginning or ending?',
              session.itemIndex === 0 ? 'opening' : 'closing-listen',
            )
          }
        />
      )
      break
    case 'l3-s01':
      activity = (
        <FunctionPractice
          stateId="l3-s01"
          session={session}
          contexts={[MODULE1_CONTEXTS.basketball, MODULE1_CONTEXTS.bicycle]}
          feedback={feedback}
          onRespond={(correct) =>
            respond({
              correct,
              retryText: 'Try again.',
              onCorrect: (next) => {
                if (session.itemIndex === 0) return setBrowserItem(next, 1)
                return advanceState(
                  withCapabilities(next, ['changed-context-w1-w2-retrieval']),
                )
              },
            })
          }
          onHelp={() =>
            applyHelp('Is the interaction starting or ending?')
          }
        />
      )
      break
    case 'l3-s02':
      activity = (
        <ListeningMomentActivity
          stateId="l3-s02"
          session={session}
          context={
            session.itemIndex === 0
              ? MODULE1_CONTEXTS.basketball
              : MODULE1_CONTEXTS.bicycle
          }
          role={session.itemIndex === 0 ? 'w1-neutral' : 'w2-neutral'}
          correctPhase={session.itemIndex === 0 ? 'opening' : 'closing'}
          feedback={feedback}
          onAudio={(role) => recordAudioPlay(role, 'listening')}
          onRespond={(correct) =>
            respond({
              correct,
              retryText: 'Try again.',
              suffix: 'listening',
              onCorrect: (next) => {
                if (session.itemIndex === 0) return setBrowserItem(next, 1)
                return advanceState(
                  withCapabilities(next, ['listening-without-answer-print']),
                )
              },
            })
          }
          onHelp={() =>
            applyHelp(
              session.itemIndex === 0
                ? 'Replay. Is the interaction starting or ending?'
                : 'Replay. Follow the interaction from arrival to departure.',
              'listening',
            )
          }
        />
      )
      break
    case 'l3-s03':
      activity = useNonvisualAlternatives ? (
        <ConstructionActivity
          session={session}
          contractId={
            session.itemIndex === 0 ? 'l3-w1-reduced' : 'l3-w2-reduced'
          }
          cue={
            <StaticContext
              context={
                session.itemIndex === 0
                  ? MODULE1_CONTEXTS.bicycle
                  : MODULE1_CONTEXTS.basketball
              }
              phase={session.itemIndex === 0 ? 'opening' : 'closing'}
            />
          }
          prompt="Build the word that belongs here."
          feedback={feedback}
          onCommit={commit}
          onComplete={(next) => {
            if (session.itemIndex === 0) {
              commit(setBrowserItem(next, 1))
            } else {
              commit(
                advanceState(
                  withCapabilities(next, ['reading-without-auto-target-audio']),
                ),
              )
            }
          }}
          helpCopy="Read from the left. Open sound Help only if you need it."
        />
      ) : (
        <ReadingMomentActivity
          stateId="l3-s03"
          session={session}
          target={session.itemIndex === 0 ? W1 : W2}
          context={
            session.itemIndex === 0
              ? MODULE1_CONTEXTS.bicycle
              : MODULE1_CONTEXTS.basketball
          }
          feedback={feedback}
          onRespond={(correct) =>
            respond({
              correct,
              retryText: 'Read it again from the left, then choose.',
              onCorrect: (next) => {
                if (session.itemIndex === 0) return setBrowserItem(next, 1)
                return advanceState(
                  withCapabilities(next, ['reading-without-auto-target-audio']),
                )
              },
            })
          }
          onHelp={() =>
            applyHelp(
              'Use sound Help only for the part you need, then try again.',
            )
          }
        />
      )
      break
    case 'l3-s04':
      activity = (
        <ConstructionActivity
          session={session}
          contractId={
            session.itemIndex === 0 ? 'l3-w1-reduced' : 'l3-w2-reduced'
          }
          cue={
            session.itemIndex === 0 ? (
              <StaticContext context={MODULE1_CONTEXTS.bicycle} phase="opening" />
            ) : (
              <AudioGate
                role="w2-neutral"
                evidenceRequired
                onPlayed={() => recordAudioPlay('w2-neutral', 'construction')}
              />
            )
          }
          prompt={
            session.itemIndex === 0
              ? 'Build the word that belongs here.'
              : 'Listen. Build the word you hear.'
          }
          inputReady={
            session.itemIndex === 0 ||
            session.playedAudioRoles.includes('w2-neutral')
          }
          feedback={feedback}
          onCommit={commit}
          onComplete={(next) => {
            if (session.itemIndex === 0) {
              commit(setBrowserItem(next, 1))
            } else {
              commit(
                advanceState(
                  withCapabilities(next, [
                    'embedded-k2-renewal',
                    'reduced-support-orthographic-retrieval',
                  ]),
                ),
              )
            }
          }}
          helpCopy="Keep what is correct. Recheck the part that stopped you."
          supportedHelpCopy="Replay this sound, then return to the word."
          answerHelpCopy="Use Help for the difficult part, then make a fresh attempt."
        />
      )
      break
    case 'l3-s05':
      activity = (
        <L3S05
          session={session}
          feedback={feedback}
          onAudio={(role) => recordAudioPlay(role, 'integrated')}
          onOpening={(correct) =>
            respond({
              correct,
              retryText: 'Try again.',
              suffix: 'integrated-opening',
              onCorrect: (next) => setBrowserItem(next, 1),
            })
          }
          onClosing={(correct) =>
            respond({
              correct,
              retryText: 'Read it again from the left, then choose.',
              suffix: 'integrated-closing',
              onCorrect: (next) =>
                advanceState(
                  withCapabilities(next, ['integrated-opening-closing-arc']),
                ),
            })
          }
          onHelp={() =>
            applyHelp(
              session.itemIndex === 0
                ? 'Is the interaction starting or ending?'
                : 'Read from the left. Open sound Help only if you need it.',
              session.itemIndex === 0
                ? 'integrated-opening'
                : 'integrated-closing',
            )
          }
        />
      )
      break
    case 'l3-s06': {
      const ready = canEmitLessonComplete(
        MODULE1_LESSON_RUNTIME_CONTRACTS['lesson-3'],
        session.opportunities,
      )
      if (ready && !completionSentRef.current) {
        queueMicrotask(() => {
          if (completionSentRef.current) return
          completionSentRef.current = true
          emitLessonComplete('lesson-3')
        })
      }
      activity = (
        <CompletionState
          copy={COMPLETION_COPY['lesson-3']}
          ready={ready}
        />
      )
      break
    }
    case 'l4-s01':
      activity = (
        <ListeningMomentActivity
          stateId="l4-s01"
          session={session}
          context={
            session.itemIndex === 0
              ? MODULE1_CONTEXTS.market
              : MODULE1_CONTEXTS.garden
          }
          role={session.itemIndex === 0 ? 'w1-neutral' : 'w2-neutral'}
          correctPhase={session.itemIndex === 0 ? 'opening' : 'closing'}
          feedback={feedback}
          onAudio={(role) => recordAudioPlay(role, 'listening')}
          onRespond={(correct) =>
            respond({
              correct,
              retryText:
                session.itemIndex === 0
                  ? 'Try again. Follow the interaction from before contact to after it begins.'
                  : 'Try again. Follow the interaction to the point where it ends.',
              suffix: 'listening',
              onCorrect: (next) => {
                if (session.itemIndex === 0) return setBrowserItem(next, 1)
                return advanceState(
                  withCapabilities(next, [
                    'fresh-function-retrieval',
                    'delayed-fresh-context-listening',
                  ]),
                )
              },
            })
          }
          onHelp={() =>
            applyHelp(
              session.itemIndex === 0
                ? 'Replay once. Look for when contact begins.'
                : 'Replay once. Look for the leaving moment.',
              'listening',
            )
          }
        />
      )
      break
    case 'l4-s02':
      activity = useNonvisualAlternatives ? (
        <ConstructionActivity
          session={session}
          contractId={
            session.itemIndex === 0 ? 'l4-w1-low-support' : 'l4-w2-low-support'
          }
          cue={
            <StaticContext
              context={
                session.itemIndex === 0
                  ? MODULE1_CONTEXTS.garden
                  : MODULE1_CONTEXTS.market
              }
              phase={session.itemIndex === 0 ? 'opening' : 'closing'}
            />
          }
          prompt="Build the word that belongs here."
          feedback={feedback}
          onCommit={commit}
          onComplete={(next) => {
            if (session.itemIndex === 0) {
              commit(setBrowserItem(next, 1))
            } else {
              commit(
                advanceState(
                  withCapabilities(next, ['reduced-support-reading-function']),
                ),
              )
            }
          }}
          helpCopy="Open one sound only if you need it, then make a fresh attempt."
        />
      ) : (
        <ReadingMomentActivity
          stateId="l4-s02"
          session={session}
          target={session.itemIndex === 0 ? W1 : W2}
          context={
            session.itemIndex === 0
              ? MODULE1_CONTEXTS.garden
              : MODULE1_CONTEXTS.market
          }
          feedback={feedback}
          onRespond={(correct) =>
            respond({
              correct,
              retryText: 'Read again, then choose.',
              onCorrect: (next) => {
                if (session.itemIndex === 0) return setBrowserItem(next, 1)
                return advanceState(
                  withCapabilities(next, ['reduced-support-reading-function']),
                )
              },
            })
          }
          onHelp={() =>
            applyHelp(
              'Open one sound only if you need it, then make a fresh attempt.',
            )
          }
        />
      )
      break
    case 'l4-s03':
      activity = (
        <ConstructionActivity
          session={session}
          contractId={
            session.itemIndex === 0 ? 'l4-w1-low-support' : 'l4-w2-low-support'
          }
          cue={
            session.itemIndex === 0 ? (
              <StaticContext context={MODULE1_CONTEXTS.market} phase="opening" />
            ) : (
              <AudioGate
                role="w2-neutral"
                evidenceRequired
                onPlayed={() => recordAudioPlay('w2-neutral', 'construction')}
              />
            )
          }
          prompt={
            session.itemIndex === 0
              ? 'Build the word that belongs here.'
              : 'Listen. Build the word you hear.'
          }
          inputReady={
            session.itemIndex === 0 ||
            session.playedAudioRoles.includes('w2-neutral')
          }
          feedback={feedback}
          onCommit={commit}
          onComplete={(next) => {
            if (session.itemIndex === 0) {
              commit(setBrowserItem(next, 1))
            } else {
              commit(
                advanceState(
                  withCapabilities(next, [
                    'module-low-support-orthographic-retrieval',
                  ]),
                ),
              )
            }
          }}
          helpCopy="Recheck the part that stopped you."
          supportedHelpCopy="Replay one sound, then continue."
        />
      )
      break
    case 'l4-s04':
      activity = (
        <L4S04
          session={session}
          feedback={feedback}
          onAudio={() => recordAudioPlay('w2-neutral', 'integrated-closing')}
          onOpening={(correct) =>
            respond({
              correct,
              retryText:
                'Follow the interaction from arrival to departure, then try again.',
              suffix: 'integrated-opening',
              onCorrect: (next) => setBrowserItem(next, 1),
            })
          }
          onClosing={(correct) =>
            respond({
              correct,
              retryText:
                'Follow the interaction from arrival to departure, then try again.',
              suffix: 'integrated-closing',
              onCorrect: (next) =>
                advanceState(
                  withCapabilities(next, ['integrated-opening-closing-arc']),
                ),
            })
          }
          onHelp={() =>
            applyHelp(
              session.itemIndex === 0
                ? 'Look for where contact begins.'
                : 'Look for where the interaction ends.',
              session.itemIndex === 0
                ? 'integrated-opening'
                : 'integrated-closing',
            )
          }
        />
      )
      break
    case 'l4-s05': {
      const ready = canEmitLessonComplete(
        MODULE1_LESSON_RUNTIME_CONTRACTS['lesson-4'],
        session.opportunities,
      )
      if (ready && !completionSentRef.current) {
        queueMicrotask(() => {
          if (completionSentRef.current) return
          completionSentRef.current = true
          emitLessonComplete('lesson-4')
        })
      }
      activity = (
        <CompletionState
          copy={COMPLETION_COPY['lesson-4']}
          ready={ready}
        />
      )
      break
    }
    default:
      activity = null
  }

  return (
    <article
      className="module1-lesson"
      data-module1-state={stateSpec.id}
      data-module1-item={session.itemIndex}
      data-deferred-audio-seams={DEFERRED_W2_AUDIO_SEAMS.join('|')}
    >
      <h2 ref={headingRef} tabIndex={-1} className="activity-heading">
        {stateSpec.heading}
      </h2>
      {activity}
    </article>
  )
}

function ContextVisual({ moment }: { moment: ContextMoment }) {
  return (
    <span
      className="context-visual"
      aria-hidden="true"
      data-media-slot={moment.mediaSlot}
      data-media-status="external-slot"
      data-context-phase={moment.phase}
    >
      <span className="context-person context-person-a" />
      <span className="context-person context-person-b" />
      <span className="context-ground" />
    </span>
  )
}

function ContextChoice({
  moment,
  onChoose,
}: {
  moment: ContextMoment
  onChoose: () => void
}) {
  return (
    <button
      type="button"
      className="context-choice"
      aria-label={moment.accessibleDescription}
      data-moment-id={moment.id}
      onClick={onChoose}
    >
      <ContextVisual moment={moment} />
    </button>
  )
}

function MomentChoices({
  context,
  onChoose,
  phases,
}: {
  context: ContextSet
  onChoose: (moment: ContextMoment) => void
  phases?: readonly ContextMoment['phase'][]
}) {
  const moments = phases
    ? context.moments.filter((moment) => phases.includes(moment.phase))
    : context.moments
  return (
    <div className="moment-choice-grid" role="group" aria-label="Choose a moment">
      {moments.map((moment) => (
        <ContextChoice
          key={moment.id}
          moment={moment}
          onChoose={() => onChoose(moment)}
        />
      ))}
    </div>
  )
}

function StaticContext({
  context,
  phase,
}: {
  context: ContextSet
  phase: ContextMoment['phase']
}) {
  const moment = context.moments.find((candidate) => candidate.phase === phase)
  if (!moment) return null
  return (
    <div className="context-card" role="img" aria-label={moment.accessibleDescription}>
      <ContextVisual moment={moment} />
    </div>
  )
}

function AudioGate({
  role,
  onPlayed,
  evidenceRequired = false,
}: {
  role: AudioRole
  onPlayed: () => void
  evidenceRequired?: boolean
}) {
  const binding = MODULE1_AUDIO_BINDINGS[role]
  const audioRef = useRef<HTMLAudioElement>(null)
  const [played, setPlayed] = useState(false)
  const [failed, setFailed] = useState(false)

  const play = async () => {
    if (!binding.src) {
      setFailed(true)
      return
    }
    try {
      const audio = audioRef.current
      if (!audio) throw new Error('audio element missing')
      audio.currentTime = 0
      await audio.play()
      setPlayed(true)
      setFailed(false)
      onPlayed()
    } catch {
      setFailed(true)
    }
  }

  if (!binding.src) {
    return (
      <div
        className="audio-gate audio-deferred"
        data-audio-role={role}
        data-audio-seam={binding.seam}
        data-audio-status={binding.status}
      >
        <button
          className="button audio-button"
          type="button"
          onClick={play}
          aria-label={played ? 'Replay' : 'Listen'}
        >
          {played ? 'Replay' : 'Listen'}
        </button>
        {evidenceRequired || failed ? (
          <div className="technical-recovery" role="alert">
            <p>This audio couldn't be loaded.</p>
            <button className="button secondary-button" type="button" onClick={play}>
              Try again
            </button>
          </div>
        ) : null}
      </div>
    )
  }

  return (
    <div
      className="audio-gate"
      data-audio-role={role}
      data-audio-seam={binding.seam}
      data-audio-status={binding.status}
    >
      <audio
        ref={audioRef}
        src={binding.src}
        preload="auto"
        onError={() => setFailed(true)}
        data-audio-src={binding.src}
      />
      <button
        className="button audio-button"
        type="button"
        onClick={play}
        aria-label={played ? 'Replay' : 'Listen'}
      >
        {played ? 'Replay' : 'Listen'}
      </button>
      {failed ? (
        <div className="technical-recovery" role="alert">
          <p>This audio couldn't be loaded.</p>
          <button className="button secondary-button" type="button" onClick={play}>
            Try again
          </button>
        </div>
      ) : null}
    </div>
  )
}

function LocalHelp({ onHelp }: { onHelp: () => void }) {
  return (
    <button className="help-button" type="button" onClick={onHelp}>
      Help
    </button>
  )
}

function TargetChoices({
  openingCorrect,
  onChoose,
}: {
  openingCorrect: boolean
  onChoose: (correct: boolean) => void
}) {
  const options = openingCorrect ? [W2, W1] : [W1, W2]
  const expected = openingCorrect ? W1 : W2
  return (
    <div className="target-choice-row" role="group" aria-label="Choose the word">
      {options.map((option) => (
        <button
          key={option}
          className="target-choice"
          type="button"
          lang="uk"
          onClick={() => onChoose(option === expected)}
        >
          {option}
        </button>
      ))}
    </div>
  )
}

function L2S01({
  session,
  feedback,
  onAudio,
  onRespond,
  onHelp,
  onRenewal,
}: {
  session: BrowserLessonSession
  feedback: ReactNode
  onAudio: () => void
  onRespond: (correct: boolean) => void
  onHelp: () => void
  onRenewal: (choice: 'и' | 'і') => void
}) {
  const audioPlayed = session.playedAudioRoles.includes('w1-neutral')

  if (session.itemIndex > 0) {
    const renewal = session.itemIndex === 1 ? 'и' : 'і'
    const position = renewal === 'и' ? 2 : 4
    return (
      <section className="reintegration-card" aria-label="Word reintegration">
        <p className="target-word in-word-target" lang="uk" aria-label={W1}>
          {[...W1].map((char, index) => (
            <span
              key={`${char}-${index}`}
              className={index === position ? 'mapping-active' : undefined}
            >
              {char}
            </span>
          ))}
        </p>
        <p>Yes.</p>
        <p>Choose the matching letter.</p>
        <div className="vowel-renewal">
          <button type="button" className="grapheme-button" lang="uk" onClick={() => onRenewal('и')}>и</button>
          <button type="button" className="grapheme-button" lang="uk" onClick={() => onRenewal('і')}>і</button>
        </div>
        {feedback}
      </section>
    )
  }

  return (
    <>
      <AudioGate role="w1-neutral" onPlayed={onAudio} evidenceRequired />
      <div className="two-moment-grid">
        {MODULE1_CONTEXTS.cinema.moments.map((moment) => (
          <ContextChoice
            key={moment.id}
            moment={moment}
            onChoose={() => {
              if (!audioPlayed) return
              onRespond(moment.phase === 'opening')
            }}
          />
        ))}
      </div>
      <LocalHelp onHelp={onHelp} />
      {feedback}
    </>
  )
}

function TeachingEncounter({
  stateId,
  context,
  visibleTarget,
  audioRole,
  prompt,
  support,
  canContinue,
  onAudio,
  onContinue,
}: {
  stateId: LessonStateId
  context: ContextSet
  visibleTarget: string
  audioRole: AudioRole
  prompt: string
  support: string
  canContinue: boolean
  onAudio: () => void
  onContinue: () => void
}) {
  return (
    <section className="teaching-encounter" data-state={stateId}>
      <StaticContext context={context} phase="closing" />
      <p className="target-word" lang="uk">{visibleTarget}</p>
      <p className="helper-text">{prompt}</p>
      <AudioGate role={audioRole} onPlayed={onAudio} />
      <p className="support-line">{support}</p>
      <button
        className="button primary-button"
        type="button"
        disabled={!canContinue}
        onClick={onContinue}
      >
        Continue
      </button>
    </section>
  )
}

function FunctionPractice({
  stateId,
  session,
  contexts,
  feedback,
  onRespond,
  onHelp,
}: {
  stateId: LessonStateId
  session: BrowserLessonSession
  contexts: readonly [ContextSet, ContextSet]
  feedback: ReactNode
  onRespond: (correct: boolean) => void
  onHelp: () => void
}) {
  const context = contexts[session.itemIndex] ?? contexts[0]
  const phase = session.itemIndex % 2 === 0 ? 'opening' : 'closing'
  return (
    <section data-state={stateId}>
      <StaticContext context={context} phase={phase} />
      <TargetChoices
        openingCorrect={phase === 'opening'}
        onChoose={onRespond}
      />
      <LocalHelp onHelp={onHelp} />
      {feedback}
    </section>
  )
}

function MappingSequence({
  session,
  feedback,
  onAudio,
  onCorrect,
  onIncorrect,
  onHelp,
}: {
  session: BrowserLessonSession
  feedback: ReactNode
  onAudio: (role: AudioRole) => void
  onCorrect: () => void
  onIncorrect: () => void
  onHelp: () => void
}) {
  const grapheme = W2_MAPPING_ORDER[session.itemIndex] ?? 'Б'
  const roleMap: Record<(typeof W2_MAPPING_ORDER)[number], AudioRole> = {
    Б: 'w2-map-b',
    у: 'w2-map-u',
    а: 'w2-map-a',
    й: 'w2-map-j',
    в: 'w1-map-v',
  }
  const role = roleMap[grapheme]
  const activeIndex = W2.indexOf(grapheme)
  const options =
    grapheme === 'в'
      ? ['в', 'і', 'а']
      : grapheme === 'Б'
        ? ['Б', 'в', 'у']
        : grapheme === 'у'
          ? ['а', 'у', 'й']
          : grapheme === 'а'
            ? ['й', 'а', 'у']
            : ['у', 'й', 'а']
  const audioPlayed = session.playedAudioRoles.includes(role)

  return (
    <section className="mapping-activity">
      <p className="target-word in-word-target" lang="uk" aria-label={W2}>
        {[...W2].map((char, index) => (
          <span
            key={`${char}-${index}`}
            className={index === activeIndex ? 'mapping-active' : undefined}
          >
            {char}
          </span>
        ))}
      </p>
      <p>
        {grapheme === 'в'
          ? 'You have seen в before. Listen to it here.'
          : 'Listen. Tap the matching letter.'}
      </p>
      <AudioGate
        role={role}
        onPlayed={() => onAudio(role)}
        evidenceRequired={grapheme !== 'в'}
      />
      <div className="grapheme-choice-row" role="group" aria-label="Choose the matching letter">
        {options.map((option) => (
          <button
            key={option}
            className="grapheme-button"
            type="button"
            lang="uk"
            disabled={!audioPlayed}
            onClick={() => {
              if (option === grapheme) onCorrect()
              else onIncorrect()
            }}
          >
            {option}
          </button>
        ))}
      </div>
      <LocalHelp onHelp={onHelp} />
      {feedback}
      {grapheme === 'в' ? (
        <p className="support-line">Find в inside Бувай, then return to the whole word.</p>
      ) : null}
    </section>
  )
}

function ReadingMomentActivity({
  stateId,
  session,
  target,
  context,
  phases,
  feedback,
  onRespond,
  onHelp,
}: {
  stateId: LessonStateId
  session: BrowserLessonSession
  target: string
  context: ContextSet
  phases?: readonly ContextMoment['phase'][]
  feedback: ReactNode
  onRespond: (correct: boolean) => void
  onHelp: () => void
}) {
  const expectedPhase = target === W1 ? 'opening' : 'closing'
  return (
    <section data-state={stateId} data-reading-target={target === W1 ? 'w1' : 'w2'}>
      <p className="target-word" lang="uk">{target}</p>
      <MomentChoices
        context={context}
        phases={phases}
        onChoose={(moment) => onRespond(moment.phase === expectedPhase)}
      />
      <LocalHelp onHelp={onHelp} />
      {feedback}
    </section>
  )
}

function ListeningMomentActivity({
  stateId,
  session,
  context,
  role,
  correctPhase,
  feedback,
  onAudio,
  onRespond,
  onHelp,
}: {
  stateId: LessonStateId
  session: BrowserLessonSession
  context: ContextSet
  role: AudioRole
  correctPhase: ContextMoment['phase']
  feedback: ReactNode
  onAudio: (role: AudioRole) => void
  onRespond: (correct: boolean) => void
  onHelp: () => void
}) {
  const binding = MODULE1_AUDIO_BINDINGS[role]
  const audioPlayed = session.playedAudioRoles.includes(role)

  return (
    <section
      data-state={stateId}
      data-listening-protected="true"
      data-answer-print-visible="false"
    >
      <AudioGate
        role={role}
        onPlayed={() => onAudio(role)}
        evidenceRequired
      />
      {binding.src && audioPlayed ? (
        <MomentChoices
          context={context}
          onChoose={(moment) => onRespond(moment.phase === correctPhase)}
        />
      ) : null}
      <LocalHelp onHelp={onHelp} />
      {feedback}
    </section>
  )
}

function ConstructionActivity({
  session,
  contractId,
  cue,
  prompt,
  inputReady = true,
  feedback,
  onCommit,
  onComplete,
  helpCopy,
  supportedHelpCopy,
  answerHelpCopy,
}: {
  session: BrowserLessonSession
  contractId: ConstructionContractId
  cue: ReactNode
  prompt: string
  inputReady?: boolean
  feedback: ReactNode
  onCommit: (session: BrowserLessonSession) => void
  onComplete: (session: BrowserLessonSession) => void
  helpCopy: string
  supportedHelpCopy?: string
  answerHelpCopy?: string
}) {
  const contract = MODULE1_CONSTRUCTION_CONTRACTS[contractId]
  const key = evidenceKey(session, contractId)
  const initial = useMemo(() => createConstructionState(contract), [contract])
  const construction = session.constructionByKey[key] ?? initial
  const pool = getConstructionPool(contract)
  const target =
    contract.targetId === 'w1' ? W1 : W2
  const helpDepth = session.helpDepthByKey[key] ?? 0

  const commitConstruction = (
    nextConstruction: typeof construction,
    nextEvidence?: EvidenceRecord,
  ) => {
    let next = setBrowserConstruction(session, key, nextConstruction)
    if (nextEvidence) next = setBrowserEvidence(next, key, nextEvidence)
    onCommit(next)
  }

  const add = (grapheme: (typeof pool)[number]) => {
    if (
      pool.filter((candidate) => candidate === grapheme).length <=
      construction.sequence.filter((candidate) => candidate === grapheme).length
    ) {
      return
    }
    commitConstruction(
      appendConstructionGrapheme(construction, contract, grapheme),
    )
  }

  const undo = () =>
    commitConstruction(undoConstructionGrapheme(construction))

  const check = () => {
    const active = ensureActiveEvidence(session.evidenceByKey[key], key)
    const submission = submitConstruction(construction, contract)
    const responded = recordResponse(
      active,
      submission.result.correct ? 'correct' : 'incorrect',
    )
    let next = setBrowserConstruction(session, key, submission.state)
    next = setBrowserEvidence(next, key, responded)

    if (!submission.result.correct) {
      next = setBrowserFeedback(next, {
        key,
        kind: 'retry',
        text: 'Try again.',
      })
      onCommit(next)
      return
    }

    next = setBrowserEvidence(next, key, completeEvidence(responded))
    next = setBrowserFeedback(next, {
      key,
      kind: 'success',
      text: 'Yes.',
    })
    onComplete(next)
  }

  const help = () => {
    const existing = session.evidenceByKey[key] ?? createEvidenceRecord()
    let nextEvidence: EvidenceRecord
    let text: string
    if (helpDepth === 0) {
      nextEvidence = recordHelp(existing, 'mapping-specific', `${key}:help-1`)
      text = helpCopy
    } else if (helpDepth === 1) {
      nextEvidence = recordSupportedRecovery(existing, `${key}:help-2`)
      text = supportedHelpCopy ?? helpCopy
    } else {
      nextEvidence = recordAnswerBearingRecovery(existing, `${key}:help-3`)
      text = answerHelpCopy ?? supportedHelpCopy ?? helpCopy
    }

    let nextConstruction = recordConstructionHelp(
      construction,
      helpDepth === 0
        ? 'mapping-specific'
        : helpDepth === 1
          ? 'supported-review'
          : 'full-answer',
    )
    let next = setBrowserConstruction(session, key, nextConstruction)
    next = setBrowserEvidence(next, key, nextEvidence)
    next = setBrowserHelpDepth(next, key, helpDepth + 1)
    next = setBrowserFeedback(next, {
      key,
      kind: helpDepth === 0 ? 'retry' : 'support',
      text,
    })
    onCommit(next)
  }

  const canCheck = contract.targetLengthSupport
    ? construction.sequence.length === target.length
    : construction.sequence.length > 0

  return (
    <section
      className="construction-activity"
      data-construction-contract={contract.id}
      data-target-length-support={String(contract.targetLengthSupport)}
      data-per-placement-correctness="false"
      data-input-ready={String(inputReady)}
    >
      <div className="construction-cue">{cue}</div>
      <p>{prompt}</p>
      {contract.targetLengthSupport ? (
        <div className="construction-slots" aria-label="Build area">
          {Array.from({ length: target.length }, (_, index) => (
            <span
              key={index}
              className="construction-slot"
              aria-label={`Position ${index + 1}`}
            >
              <span lang="uk">{construction.sequence[index] ?? ''}</span>
            </span>
          ))}
        </div>
      ) : (
        <div className="construction-build-area" aria-label="Build area">
          {construction.sequence.length ? (
            construction.sequence.map((grapheme, index) => (
              <span key={`${grapheme}-${index}`} lang="uk">{grapheme}</span>
            ))
          ) : (
            <span className="visually-hidden">Empty</span>
          )}
        </div>
      )}
      <div className="construction-pool" role="group" aria-label="Available letters">
        {pool.map((grapheme) => {
          const used =
            construction.sequence.filter((candidate) => candidate === grapheme)
              .length >= pool.filter((candidate) => candidate === grapheme).length
          return (
            <button
              key={grapheme}
              className="grapheme-button"
              type="button"
              lang="uk"
              disabled={used || !inputReady}
              onClick={() => add(grapheme)}
            >
              {grapheme}
            </button>
          )
        })}
      </div>
      <div className="construction-actions">
        <button
          className="button secondary-button"
          type="button"
          disabled={construction.sequence.length === 0}
          onClick={undo}
        >
          Undo
        </button>
        <button
          className="button primary-button"
          type="button"
          disabled={!inputReady || !canCheck}
          onClick={check}
        >
          Check
        </button>
      </div>
      <LocalHelp onHelp={help} />
      {helpDepth >= 3 ? (
        <div className="answer-bearing-recovery" role="status">
          <span lang="uk">{target}</span>
        </div>
      ) : null}
      {feedback}
    </section>
  )
}

function L2S07({
  session,
  feedback,
  onAudio,
  onOpening,
  onClosing,
  onHelp,
}: {
  session: BrowserLessonSession
  feedback: ReactNode
  onAudio: () => void
  onOpening: (correct: boolean) => void
  onClosing: (correct: boolean) => void
  onHelp: () => void
}) {
  if (session.itemIndex === 0) {
    return (
      <section>
        <StaticContext context={MODULE1_CONTEXTS.riversideWalk} phase="opening" />
        <TargetChoices openingCorrect onChoose={onOpening} />
        <LocalHelp onHelp={onHelp} />
        {feedback}
      </section>
    )
  }

  const played = session.playedAudioRoles.includes('w2-neutral')
  return (
    <section data-listening-protected="true">
      <AudioGate
        role="w2-neutral"
        evidenceRequired
        onPlayed={onAudio}
      />
      {played ? (
        <MomentChoices
          context={MODULE1_CONTEXTS.riversideWalk}
          onChoose={(moment) => onClosing(moment.phase === 'closing')}
        />
      ) : null}
      <LocalHelp onHelp={onHelp} />
      {feedback}
    </section>
  )
}

function L3S05({
  session,
  feedback,
  onAudio,
  onOpening,
  onClosing,
  onHelp,
}: {
  session: BrowserLessonSession
  feedback: ReactNode
  onAudio: (role: AudioRole) => void
  onOpening: (correct: boolean) => void
  onClosing: (correct: boolean) => void
  onHelp: () => void
}) {
  if (session.itemIndex === 0) {
    const comparisonReady = Boolean(
      MODULE1_AUDIO_BINDINGS['w1-neutral'].src &&
        MODULE1_AUDIO_BINDINGS['w2-neutral'].src,
    )
    return (
      <section className="integrated-arc" data-listening-protected="true">
        <StaticContext context={MODULE1_CONTEXTS.artStudio} phase="opening" />
        <div className="audio-choice-grid" role="group" aria-label="Choose an audio option">
          <AudioChoiceCard
            label="Audio 1"
            role="w1-neutral"
            choiceEnabled={comparisonReady}
            onPlayed={() => onAudio('w1-neutral')}
            onChoose={() => onOpening(true)}
          />
          <AudioChoiceCard
            label="Audio 2"
            role="w2-neutral"
            choiceEnabled={comparisonReady}
            onPlayed={() => onAudio('w2-neutral')}
            onChoose={() => onOpening(false)}
          />
        </div>
        <LocalHelp onHelp={onHelp} />
        {feedback}
      </section>
    )
  }

  return (
    <section className="integrated-arc">
      <p className="target-word" lang="uk">{W2}</p>
      <MomentChoices
        context={MODULE1_CONTEXTS.artStudio}
        onChoose={(moment) => onClosing(moment.phase === 'closing')}
      />
      <LocalHelp onHelp={onHelp} />
      {feedback}
    </section>
  )
}

function AudioChoiceCard({
  label,
  role,
  choiceEnabled,
  onPlayed,
  onChoose,
}: {
  label: string
  role: AudioRole
  choiceEnabled: boolean
  onPlayed: () => void
  onChoose: () => void
}) {
  const binding = MODULE1_AUDIO_BINDINGS[role]
  return (
    <div
      className="audio-choice-card"
      data-audio-choice={label}
      data-audio-role={role}
      data-audio-seam={binding.seam}
    >
      <strong>{label}</strong>
      <AudioGate role={role} onPlayed={onPlayed} evidenceRequired />
      <button
        className="button secondary-button"
        type="button"
        disabled={!binding.src || !choiceEnabled}
        onClick={onChoose}
        aria-label={`Choose ${label.toLowerCase()}`}
      >
        Choose
      </button>
    </div>
  )
}

function L4S04({
  session,
  feedback,
  onAudio,
  onOpening,
  onClosing,
  onHelp,
}: {
  session: BrowserLessonSession
  feedback: ReactNode
  onAudio: () => void
  onOpening: (correct: boolean) => void
  onClosing: (correct: boolean) => void
  onHelp: () => void
}) {
  if (session.itemIndex === 0) {
    return (
      <section className="integrated-arc">
        <StaticContext context={MODULE1_CONTEXTS.foodTruck} phase="opening" />
        <TargetChoices openingCorrect onChoose={onOpening} />
        <LocalHelp onHelp={onHelp} />
        {feedback}
      </section>
    )
  }

  const played = session.playedAudioRoles.includes('w2-neutral')
  return (
    <section className="integrated-arc" data-listening-protected="true">
      <AudioGate
        role="w2-neutral"
        evidenceRequired
        onPlayed={onAudio}
      />
      {played ? (
        <MomentChoices
          context={MODULE1_CONTEXTS.foodTruck}
          onChoose={(moment) => onClosing(moment.phase === 'closing')}
        />
      ) : null}
      <LocalHelp onHelp={onHelp} />
      {feedback}
    </section>
  )
}

function CompletionState({
  copy,
  ready,
}: {
  copy: string
  ready: boolean
}) {
  return (
    <section
      className="runtime-completion"
      role="status"
      data-completion-ready={String(ready)}
    >
      <p>{copy}</p>
    </section>
  )
}
