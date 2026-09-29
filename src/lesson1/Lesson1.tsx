import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ACCESSIBLE_L9_HELP_TRIGGERS,
  BUILD_PASS_CONFIGS,
  LESSON1_AUDIO_ASSETS,
  createMappingPractice,
  createVowelPractice,
  getVisualL9Options,
  scheduleAdaptiveRetry,
  type Lesson1AudioAssetId,
  type MappingPracticeTrial,
  type MappingAudioAssetId,
  type TaughtGrapheme,
  type VowelPracticeTrial,
} from './browser-model'
import {
  ACCESSIBLE_L9_COMPONENTS,
  completeCurrentEpisode,
  createInitialLesson1State,
  recordAccessibleL9Help,
  recordAccessibleL9Reintegration,
  recordMappingAttempt,
  recordReconstructionAttempt,
  recordSemanticReconnection,
  recordVisualL9Attempt,
  recordVisualL9Help,
  recordVowelContrastAttempt,
  selectAccessibleL9Component,
  selectL9Route,
  submitAccessibleL9Sequence,
  undoAccessibleL9Component,
  type AccessibleL9Component,
  type Lesson1RuntimeState,
  type VisualL9OptionId,
} from './state'

const TARGET_SEQUENCE: readonly AccessibleL9Component[] = [
  'П',
  'р',
  'и',
  'в',
  'і',
  'т',
]

type ContextKind = 'courtyard' | 'park'
type ContextMoment = 'before' | 'beginning' | 'engaged' | 'departure'

interface ContextOption {
  id: string
  moment: ContextMoment
  correct: boolean
  accessibleLabel: string
}

const COURTYARD_OPTIONS: readonly ContextOption[] = [
  {
    id: 'c2-before',
    moment: 'before',
    correct: false,
    accessibleLabel: 'Before contact',
  },
  {
    id: 'c2-beginning',
    moment: 'beginning',
    correct: true,
    accessibleLabel: 'Beginning of contact',
  },
  {
    id: 'c2-engaged',
    moment: 'engaged',
    correct: false,
    accessibleLabel: 'Already engaged',
  },
]

const PARK_OPTIONS: readonly ContextOption[] = [
  {
    id: 'c6-approach',
    moment: 'before',
    correct: false,
    accessibleLabel: 'Approach',
  },
  {
    id: 'c6-beginning',
    moment: 'beginning',
    correct: true,
    accessibleLabel: 'Beginning of contact',
  },
  {
    id: 'c6-engaged',
    moment: 'engaged',
    correct: false,
    accessibleLabel: 'Already engaged',
  },
  {
    id: 'c6-departure',
    moment: 'departure',
    correct: false,
    accessibleLabel: 'Departure',
  },
]

function rotate<T>(items: readonly T[], amount: number): readonly T[] {
  if (items.length === 0) return items
  const offset = amount % items.length
  return [...items.slice(offset), ...items.slice(0, offset)]
}

function sequenceMatches(
  actual: readonly AccessibleL9Component[],
  expected: readonly AccessibleL9Component[],
): boolean {
  return (
    actual.length === expected.length &&
    actual.every((item, index) => item === expected[index])
  )
}

function AudioControl({
  audioId,
  label,
  onChoose,
  index,
}: {
  audioId: Lesson1AudioAssetId | MappingAudioAssetId
  label: 'Listen' | 'Replay'
  onChoose?: () => void
  index?: number
}) {
  const asset = LESSON1_AUDIO_ASSETS[audioId]
  return (
    <button
      className="audio-control"
      type="button"
      data-audio-id={asset.id}
      data-audio-status={asset.status}
      aria-label={index === undefined ? label : `${label} ${index}`}
      onClick={onChoose}
    >
      <span className="audio-icon" aria-hidden="true">
        ▶
      </span>
      <span>{label}</span>
      {index === undefined ? null : (
        <span className="audio-index" aria-hidden="true">
          {index}
        </span>
      )}
    </button>
  )
}

function Progress({ step }: { step: number }) {
  return (
    <div className="lesson-progress" aria-hidden="true">
      {Array.from({ length: 8 }, (_, index) => (
        <span
          className={index <= step ? 'progress-dot is-active' : 'progress-dot'}
          key={index}
        />
      ))}
    </div>
  )
}

function SceneArt({
  kind,
  moment,
}: {
  kind: ContextKind | 'greeting'
  moment: ContextMoment
}) {
  const isPark = kind === 'park'
  const isBeginning = moment === 'beginning'
  const isEngaged = moment === 'engaged'
  const isDeparture = moment === 'departure'

  return (
    <div
      className={`scene-art scene-${kind} moment-${moment}`}
      aria-hidden="true"
    >
      {isPark ? (
        <>
          <span className="tree tree-left" />
          <span className="tree tree-right" />
          <span className="bench" />
        </>
      ) : (
        <>
          <span className="courtyard-wall" />
          <span className="courtyard-window" />
        </>
      )}
      <span
        className={`person person-a ${
          isBeginning || isEngaged ? 'is-near' : ''
        }`}
      >
        <span className="person-head" />
        <span className="person-body" />
      </span>
      <span
        className={`person person-b ${
          isBeginning || isEngaged ? 'is-near' : ''
        } ${isDeparture ? 'is-leaving' : ''}`}
      >
        <span className="person-head" />
        <span className="person-body" />
      </span>
    </div>
  )
}

function ContextChoice({
  kind,
  options,
  onComplete,
}: {
  kind: ContextKind
  options: readonly ContextOption[]
  onComplete: () => void
}) {
  const [feedback, setFeedback] = useState<'idle' | 'retry' | 'success'>(
    'idle',
  )

  function choose(option: ContextOption) {
    if (option.correct) {
      setFeedback('success')
      return
    }
    setFeedback('retry')
  }

  return (
    <section className="lesson-card context-step">
      <div className="action-heading">Choose</div>
      <div
        className={`context-grid context-grid-${options.length}`}
        role="group"
        aria-label="Choose"
      >
        {options.map((option, index) => (
          <button
            className="scene-choice"
            type="button"
            key={option.id}
            aria-label={option.accessibleLabel}
            onClick={() => choose(option)}
          >
            <span className="scene-number" aria-hidden="true">
              {index + 1}
            </span>
            <SceneArt kind={kind} moment={option.moment} />
          </button>
        ))}
      </div>
      <div className="feedback-row" aria-live="polite">
        {feedback === 'retry' ? <span>Try again</span> : null}
        {feedback === 'success' ? (
          <>
            <span className="success-mark" aria-label="Correct">
              ✓
            </span>
            <button className="primary-action" type="button" onClick={onComplete}>
              Continue
            </button>
          </>
        ) : null}
      </div>
    </section>
  )
}

function MappingPractice({
  onComplete,
  runtime,
  setRuntime,
}: {
  onComplete: () => void
  runtime: Lesson1RuntimeState
  setRuntime: React.Dispatch<React.SetStateAction<Lesson1RuntimeState>>
}) {
  const [trials, setTrials] = useState<readonly MappingPracticeTrial[]>(() =>
    createMappingPractice(),
  )
  const [trialIndex, setTrialIndex] = useState(0)
  const [feedback, setFeedback] = useState<'idle' | 'retry'>('idle')
  const [retryCounts, setRetryCounts] = useState<Record<string, number>>({})

  const trial = trials[trialIndex]

  if (trial === undefined) {
    return (
      <section className="lesson-card practice-step">
        <div className="practice-word" lang="uk">
          Привіт
        </div>
        <button className="primary-action" type="button" onClick={onComplete}>
          Continue
        </button>
      </section>
    )
  }

  const activeTrial = trial
  const retryKey = `${activeTrial.mappingId}:${activeTrial.direction}`
  const rotation = trialIndex % 3

  function record(outcome: 'success' | 'failure') {
    setRuntime((current) =>
      recordMappingAttempt(
        current,
        activeTrial.mappingId,
        activeTrial.direction,
        outcome,
      ),
    )
  }

  function fail() {
    record('failure')
    setFeedback('retry')
    const prior = retryCounts[retryKey] ?? 0
    if (prior < 1) {
      setTrials((current) => scheduleAdaptiveRetry(current, activeTrial, prior))
      setRetryCounts((current) => ({ ...current, [retryKey]: prior + 1 }))
    }
  }

  function succeed() {
    record('success')
    setFeedback('idle')
    setTrialIndex((current) => current + 1)
  }

  const isSoundToPrint = activeTrial.direction === 'sound-to-grapheme'

  return (
    <section className="lesson-card practice-step">
      <div className="word-anchor" lang="uk">
        Привіт
      </div>
      {isSoundToPrint ? (
        <>
          <AudioControl audioId={activeTrial.promptAudioId!} label="Listen" />
          <div className="choice-row" role="group" aria-label="Tap">
            {rotate(activeTrial.graphemeChoices ?? [], rotation).map((choice) => (
              <button
                className="grapheme-button"
                type="button"
                lang="uk"
                key={choice}
                onClick={() =>
                  choice === activeTrial.correctGrapheme ? succeed() : fail()
                }
              >
                {choice}
              </button>
            ))}
          </div>
        </>
      ) : (
        <>
          <div className="focus-grapheme" lang="uk">
            {activeTrial.promptGrapheme}
          </div>
          <div className="audio-choice-row" role="group" aria-label="Listen">
            {rotate(activeTrial.audioChoices ?? [], rotation).map((choice, index) => (
              <AudioControl
                key={choice}
                audioId={choice}
                label="Listen"
                index={index + 1}
                onChoose={() =>
                  choice === activeTrial.correctAudioId ? succeed() : fail()
                }
              />
            ))}
          </div>
        </>
      )}
      <div className="feedback-row" aria-live="polite">
        {feedback === 'retry' ? <span>Try again</span> : null}
      </div>
      <span className="trial-count" aria-hidden="true">
        {Math.min(trialIndex + 1, trials.length)} / {trials.length}
      </span>
    </section>
  )
}

function VowelPractice({
  onComplete,
  setRuntime,
}: {
  onComplete: () => void
  setRuntime: React.Dispatch<React.SetStateAction<Lesson1RuntimeState>>
}) {
  const trials = useMemo(() => createVowelPractice(), [])
  const [trialIndex, setTrialIndex] = useState(0)
  const [feedback, setFeedback] = useState<'idle' | 'retry'>('idle')
  const trial: VowelPracticeTrial | undefined = trials[trialIndex]

  if (trial === undefined) {
    return (
      <section className="lesson-card vowel-step">
        <div className="practice-word" lang="uk">
          Привіт
        </div>
        <button className="primary-action" type="button" onClick={onComplete}>
          Continue
        </button>
      </section>
    )
  }

  const activeTrial = trial

  function answer(correct: boolean) {
    setRuntime((current) =>
      recordVowelContrastAttempt(
        current,
        activeTrial.mappingId === 'y' ? activeTrial.direction : activeTrial.direction,
        correct ? 'success' : 'failure',
      ),
    )
    if (!correct) {
      setFeedback('retry')
      return
    }
    setFeedback('idle')
    setTrialIndex((current) => current + 1)
  }

  return (
    <section className="lesson-card vowel-step">
      <div className="word-anchor" lang="uk">
        Привіт
      </div>
      <div className="vowel-pair" aria-hidden="true">
        <span lang="uk">и</span>
        <span lang="uk">і</span>
      </div>
      {activeTrial.direction === 'sound-to-grapheme' ? (
        <>
          <AudioControl audioId={activeTrial.audioId} label="Listen" />
          <div className="choice-row" role="group" aria-label="Tap">
            {(activeTrial.graphemeChoices ?? []).map((choice) => (
              <button
                className="grapheme-button"
                type="button"
                lang="uk"
                key={choice}
                onClick={() => answer(choice === activeTrial.grapheme)}
              >
                {choice}
              </button>
            ))}
          </div>
        </>
      ) : (
        <>
          <div className="focus-grapheme" lang="uk">
            {activeTrial.grapheme}
          </div>
          <div className="audio-choice-row" role="group" aria-label="Listen">
            {(activeTrial.audioChoices ?? []).map((choice, index) => (
              <AudioControl
                key={choice}
                audioId={choice}
                label="Listen"
                index={index + 1}
                onChoose={() => answer(choice === activeTrial.audioId)}
              />
            ))}
          </div>
        </>
      )}
      <div className="feedback-row" aria-live="polite">
        {feedback === 'retry' ? <span>Try again</span> : null}
      </div>
    </section>
  )
}

function BuildRead({
  onComplete,
  onUseAccessible,
  setRuntime,
}: {
  onComplete: () => void
  onUseAccessible: () => void
  setRuntime: React.Dispatch<React.SetStateAction<Lesson1RuntimeState>>
}) {
  const [pass, setPass] = useState(0)
  const [sequence, setSequence] = useState<AccessibleL9Component[]>([])
  const [feedback, setFeedback] = useState<'idle' | 'retry' | 'complete'>(
    'idle',
  )
  const [helpOpen, setHelpOpen] = useState(false)
  const config = BUILD_PASS_CONFIGS[pass] ?? BUILD_PASS_CONFIGS[1]
  const remaining = TARGET_SEQUENCE.filter((item) => !sequence.includes(item))

  function choose(component: AccessibleL9Component) {
    const expected = TARGET_SEQUENCE[sequence.length]
    if (component !== expected) {
      setFeedback('retry')
      setRuntime((current) =>
        recordReconstructionAttempt(current, 'failure', {
          supportUsed: helpOpen,
        }),
      )
      return
    }

    const next = [...sequence, component]
    setSequence(next)
    setFeedback(next.length === TARGET_SEQUENCE.length ? 'complete' : 'idle')
  }

  function continueAfterPass() {
    setRuntime((current) =>
      recordReconstructionAttempt(current, 'success', {
        supportUsed: pass === 0 && helpOpen,
      }),
    )
    if (pass === 0) {
      setPass(1)
      setSequence([])
      setFeedback('idle')
      setHelpOpen(false)
      return
    }
    onComplete()
  }

  return (
    <section className="lesson-card build-step">
      <div className="action-heading">Build</div>
      <div
        className="build-slots"
        aria-label={`${sequence.length} of 6`}
        aria-live="polite"
      >
        {TARGET_SEQUENCE.map((_, index) => (
          <span className="build-slot" lang="uk" key={index}>
            {sequence[index] ?? ''}
          </span>
        ))}
      </div>
      <div className="choice-row" role="group" aria-label="Build">
        {remaining.map((component) => (
          <button
            className="grapheme-button"
            type="button"
            lang="uk"
            key={component}
            onClick={() => choose(component)}
          >
            {component}
          </button>
        ))}
      </div>

      <div className="support-row">
        <button
          className="secondary-action"
          type="button"
          onClick={() => setHelpOpen((open) => !open)}
        >
          Help
        </button>
        {config.allowFullTargetReplay && helpOpen ? (
          <AudioControl audioId="neutralTarget" label="Replay" />
        ) : null}
        {config.allowBeginningSupport && helpOpen ? (
          <AudioControl audioId="beginningPr" label="Listen" />
        ) : null}
      </div>

      {helpOpen ? (
        <div className="help-strip" aria-label="Help">
          <span lang="uk">и</span>
          <span lang="uk">і</span>
          {pass === 0 ? (
            <>
              <span lang="uk">П</span>
              <span lang="uk">р</span>
            </>
          ) : null}
        </div>
      ) : null}

      <div className="feedback-row" aria-live="polite">
        {feedback === 'retry' ? <span>Try again</span> : null}
        {feedback === 'complete' ? (
          <button
            className="primary-action"
            type="button"
            onClick={continueAfterPass}
          >
            Continue
          </button>
        ) : null}
      </div>

      <button
        className="text-action nonvisual-route"
        type="button"
        onClick={onUseAccessible}
      >
        Use nonvisual version
      </button>
    </section>
  )
}

function VisualL9({
  onComplete,
  setRuntime,
}: {
  onComplete: () => void
  setRuntime: React.Dispatch<React.SetStateAction<Lesson1RuntimeState>>
}) {
  const options = useMemo(() => rotate(getVisualL9Options(), 1), [])
  const [feedback, setFeedback] = useState<'idle' | 'retry' | 'success'>(
    'idle',
  )
  const [helpOpen, setHelpOpen] = useState(false)

  function choose(optionId: VisualL9OptionId, correct: boolean) {
    setRuntime((current) => recordVisualL9Attempt(current, optionId))
    setFeedback(correct ? 'success' : 'retry')
  }

  function openHelp() {
    setHelpOpen(true)
    setRuntime((current) => recordVisualL9Help(current, false))
  }

  return (
    <section className="lesson-card l9-step">
      <div className="l9-target" lang="uk">
        Привіт
      </div>
      <div className="audio-choice-row l9-options" role="group">
        {options.map((option, index) => (
          <AudioControl
            key={option.id}
            audioId={option.audioId}
            label="Listen"
            index={index + 1}
            onChoose={() => choose(option.id, option.correct)}
          />
        ))}
      </div>
      <div className="support-row">
        <button className="secondary-action" type="button" onClick={openHelp}>
          Help
        </button>
      </div>
      {helpOpen ? (
        <div className="help-strip" aria-label="Help">
          <span lang="uk">и</span>
          <span lang="uk">і</span>
          <span lang="uk">П</span>
          <span lang="uk">р</span>
        </div>
      ) : null}
      <div className="feedback-row" aria-live="polite">
        {feedback === 'retry' ? <span>Try again</span> : null}
        {feedback === 'success' ? (
          <button className="primary-action" type="button" onClick={onComplete}>
            Continue
          </button>
        ) : null}
      </div>
    </section>
  )
}

function AccessibleL9({
  runtime,
  setRuntime,
  onComplete,
}: {
  runtime: Lesson1RuntimeState
  setRuntime: React.Dispatch<React.SetStateAction<Lesson1RuntimeState>>
  onComplete: () => void
}) {
  const accessible = runtime.l9.accessible
  const [feedback, setFeedback] = useState<'idle' | 'retry'>('idle')
  const [helpOpen, setHelpOpen] = useState(false)
  const [recoveryWordVisible, setRecoveryWordVisible] = useState(false)
  const [reintegrated, setReintegrated] = useState(false)
  const choiceGroupRef = useRef<HTMLDivElement>(null)
  const checkButtonRef = useRef<HTMLButtonElement>(null)
  const restoreReconstructionFocusRef = useRef(false)

  useEffect(() => {
    if (!restoreReconstructionFocusRef.current) return
    restoreReconstructionFocusRef.current = false

    const firstRemainingChoice =
      choiceGroupRef.current?.querySelector<HTMLButtonElement>(
        '.grapheme-button',
      )

    if (firstRemainingChoice) {
      firstRemainingChoice.focus()
      return
    }

    checkButtonRef.current?.focus()
  }, [
    accessible.currentSequence.length,
    accessible.remainingComponents.length,
  ])

  function choose(component: AccessibleL9Component) {
    restoreReconstructionFocusRef.current = true
    setRuntime((current) => selectAccessibleL9Component(current, component))
    setFeedback('idle')
  }

  function undo() {
    setRuntime((current) => undoAccessibleL9Component(current))
  }

  function openHelp() {
    setHelpOpen(true)
    if (!accessible.helpOpened) {
      setRuntime((current) =>
        recordAccessibleL9Help(current, 'level-1-neutral-review'),
      )
    }
  }

  function useVowelHelp() {
    setRuntime((current) =>
      recordAccessibleL9Help(current, 'level-2-vowel-contrast'),
    )
  }

  function useBeginningHelp() {
    setRuntime((current) =>
      recordAccessibleL9Help(current, 'level-2-cluster'),
    )
  }

  function revealRecovery() {
    setRuntime((current) =>
      recordAccessibleL9Help(current, 'level-3-answer-reveal'),
    )
    setRecoveryWordVisible(true)
  }

  function check() {
    const success = sequenceMatches(
      accessible.currentSequence,
      TARGET_SEQUENCE,
    )

    if (!success) {
      restoreReconstructionFocusRef.current = true
    }

    setRuntime((current) => {
      const submitted = submitAccessibleL9Sequence(current)
      return success ? recordAccessibleL9Reintegration(submitted) : submitted
    })

    if (success) {
      setReintegrated(true)
      setFeedback('idle')
      return
    }
    setFeedback('retry')
  }

  if (reintegrated) {
    return (
      <section className="lesson-card accessible-l9-step">
        <div className="l9-target" lang="uk">
          Привіт
        </div>
        <AudioControl audioId="neutralTarget" label="Replay" />
        <button className="primary-action" type="button" onClick={onComplete}>
          Continue
        </button>
      </section>
    )
  }

  if (recoveryWordVisible) {
    return (
      <section className="lesson-card accessible-l9-step">
        <div className="l9-target" lang="uk">
          Привіт
        </div>
        <AudioControl audioId="neutralTarget" label="Replay" />
        <button
          className="primary-action"
          type="button"
          onClick={() => {
            setRecoveryWordVisible(false)
            setHelpOpen(false)
            setFeedback('idle')
          }}
        >
          Continue
        </button>
      </section>
    )
  }

  return (
    <section className="lesson-card accessible-l9-step">
      <div
        className="accessible-progress"
        aria-live="polite"
        aria-label={`${accessible.currentSequence.length} of 6`}
      >
        <span>{accessible.currentSequence.length} of 6</span>
        <div className="built-sequence" lang="uk">
          {accessible.currentSequence.join('')}
        </div>
      </div>
      <div
        className="choice-row"
        role="group"
        aria-label="Build"
        ref={choiceGroupRef}
      >
        {accessible.remainingComponents.map((component) => (
          <button
            className="grapheme-button"
            type="button"
            lang="uk"
            key={component}
            onClick={() => choose(component)}
          >
            {component}
          </button>
        ))}
      </div>
      <div className="support-row">
        <button
          className="secondary-action"
          type="button"
          disabled={accessible.currentSequence.length === 0}
          onClick={undo}
        >
          Undo
        </button>
        <button className="secondary-action" type="button" onClick={openHelp}>
          Help
        </button>
        <button
          className="primary-action compact"
          type="button"
          ref={checkButtonRef}
          disabled={
            accessible.currentSequence.length !== ACCESSIBLE_L9_COMPONENTS.length
          }
          onClick={check}
        >
          Check
        </button>
      </div>

      {helpOpen ? (
        <div className="help-actions" aria-label="Help">
          <button
            className="help-chip"
            type="button"
            lang="uk"
            onClick={useVowelHelp}
          >
            {ACCESSIBLE_L9_HELP_TRIGGERS.vowel.label}
          </button>
          <AudioControl
            audioId={ACCESSIBLE_L9_HELP_TRIGGERS.beginning.audioId}
            label={ACCESSIBLE_L9_HELP_TRIGGERS.beginning.label}
            onChoose={useBeginningHelp}
          />
          {accessible.submittedSequences.length >= 2 ? (
            <button
              className="help-chip"
              type="button"
              onClick={revealRecovery}
            >
              Help
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="feedback-row" aria-live="polite">
        {feedback === 'retry' ? <span>Try again</span> : null}
      </div>
    </section>
  )
}

export function Lesson1() {
  const [step, setStep] = useState(0)
  const [runtime, setRuntime] = useState(() => createInitialLesson1State())
  const [preferAccessible, setPreferAccessible] = useState(false)
  const [finished, setFinished] = useState(false)

  function advance() {
    setStep((current) => Math.min(current + 1, 7))
  }

  function enterL9() {
    const route = preferAccessible ? 'accessible' : 'visual'
    setRuntime((current) => selectL9Route(current, route))
    setStep(5)
  }

  function completeSemanticChoice() {
    setRuntime((current) => recordSemanticReconnection(current, 'success'))
    setStep(7)
  }

  function finishLesson() {
    setRuntime((current) => {
      let next = current
      while (!next.lessonCompleted) {
        next = completeCurrentEpisode(next)
      }
      return next
    })
    setFinished(true)
  }

  return (
    <main className="lesson-shell">
      <div className="lesson-topbar">
        <div className="yuzu-mark" aria-label="Yuzu">
          <span className="yuzu-leaf" aria-hidden="true" />
          Yuzu
        </div>
        <Progress step={step} />
      </div>

      <div className="lesson-stage">
        {step === 0 ? (
          <section className="lesson-card encounter-step">
            <SceneArt kind="greeting" moment="beginning" />
            <div className="hero-word" lang="uk">
              Привіт
            </div>
            <AudioControl audioId="contextualTarget" label="Replay" />
            <button className="primary-action" type="button" onClick={advance}>
              Continue
            </button>
          </section>
        ) : null}

        {step === 1 ? (
          <ContextChoice
            kind="courtyard"
            options={COURTYARD_OPTIONS}
            onComplete={advance}
          />
        ) : null}

        {step === 2 ? (
          <MappingPractice
            runtime={runtime}
            setRuntime={setRuntime}
            onComplete={advance}
          />
        ) : null}

        {step === 3 ? (
          <VowelPractice setRuntime={setRuntime} onComplete={advance} />
        ) : null}

        {step === 4 ? (
          <BuildRead
            setRuntime={setRuntime}
            onUseAccessible={() => setPreferAccessible(true)}
            onComplete={enterL9}
          />
        ) : null}

        {step === 5 && runtime.l9.route === 'visual' ? (
          <VisualL9 setRuntime={setRuntime} onComplete={advance} />
        ) : null}

        {step === 5 && runtime.l9.route === 'accessible' ? (
          <AccessibleL9
            runtime={runtime}
            setRuntime={setRuntime}
            onComplete={advance}
          />
        ) : null}

        {step === 6 ? (
          <ContextChoice
            kind="park"
            options={PARK_OPTIONS}
            onComplete={completeSemanticChoice}
          />
        ) : null}

        {step === 7 ? (
          <section className="lesson-card completion-step">
            <div
              className={finished ? 'completion-orb is-complete' : 'completion-orb'}
              aria-hidden="true"
            >
              {finished ? '✓' : '8'}
            </div>
            <div className="completion-word" lang="uk">
              Привіт
            </div>
            {finished ? null : (
              <button
                className="primary-action"
                type="button"
                onClick={finishLesson}
              >
                Finish
              </button>
            )}
          </section>
        ) : null}
      </div>
    </main>
  )
}
