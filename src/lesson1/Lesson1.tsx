import { useEffect, useMemo, useRef, useState } from 'react'
import { LESSON1_AUDIO_ASSETS } from './browser-model'

type AudioId = keyof typeof LESSON1_AUDIO_ASSETS
type Grapheme = 'П' | 'п' | 'р' | 'и' | 'в' | 'і' | 'т'
type CoreGrapheme = 'П' | 'р' | 'и' | 'в' | 'і' | 'т'

type View =
  | { kind: 'encounter' }
  | { kind: 'mapping-teach'; index: number }
  | { kind: 'mapping-guided'; index: number; lowercase?: boolean }
  | { kind: 'mapping-retrieve-p' }
  | { kind: 'vowel-compare' }
  | { kind: 'vowel-trial'; index: number }
  | { kind: 'supported-build' }
  | { kind: 'reduced-build' }
  | { kind: 'context-return' }
  | { kind: 'complete' }

const WORD: readonly CoreGrapheme[] = ['П', 'р', 'и', 'в', 'і', 'т']
const SUPPORTED_BANK: readonly CoreGrapheme[] = ['в', 'П', 'т', 'и', 'р', 'і']
const REDUCED_BANK: readonly CoreGrapheme[] = ['і', 'р', 'т', 'П', 'в', 'и']

const MAPPINGS: readonly {
  grapheme: CoreGrapheme
  audio: AudioId
  guidedChoices: readonly Grapheme[]
}[] = [
  { grapheme: 'П', audio: 'p', guidedChoices: ['П', 'т', 'в'] },
  { grapheme: 'р', audio: 'r', guidedChoices: ['р', 'в', 'т'] },
  { grapheme: 'в', audio: 'v', guidedChoices: ['в', 'р', 'т'] },
  { grapheme: 'т', audio: 't', guidedChoices: ['т', 'в', 'р'] },
]

const VOWEL_TRIALS = [
  { direction: 'sound-print' as const, grapheme: 'и' as const, audio: 'y' as const },
  { direction: 'sound-print' as const, grapheme: 'і' as const, audio: 'i' as const },
  { direction: 'print-sound' as const, grapheme: 'и' as const, audio: 'y' as const },
  { direction: 'print-sound' as const, grapheme: 'і' as const, audio: 'i' as const },
]

const AUDIO_FOR: Record<CoreGrapheme, AudioId> = {
  П: 'p',
  р: 'r',
  и: 'y',
  в: 'v',
  і: 'i',
  т: 't',
}

const CONTEXTS = [
  { label: 'One person is reading as another approaches.', position: '0%' },
  { label: 'The two people face one another; one raises a hand.', position: '33.333%' },
  { label: 'The two people are sitting together looking at a phone.', position: '66.666%' },
  { label: 'One person is walking away while they wave.', position: '100%' },
] as const

function AudioButton({
  audioId,
  label = 'Listen',
  compact = false,
}: {
  audioId: AudioId
  label?: string
  compact?: boolean
}) {
  const asset = LESSON1_AUDIO_ASSETS[audioId]
  const mediaRef = useRef<HTMLAudioElement>(null)
  const [played, setPlayed] = useState(false)
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle')

  async function play() {
    const media = mediaRef.current
    if (!media) return
    setStatus('loading')

    try {
      for (const source of asset.sources) {
        media.src = source
        media.load()
        await new Promise<void>((resolve, reject) => {
          const cleanup = () => {
            media.removeEventListener('ended', onEnded)
            media.removeEventListener('error', onError)
          }
          const onEnded = () => {
            cleanup()
            resolve()
          }
          const onError = () => {
            cleanup()
            reject(new Error('audio-load-failure'))
          }
          media.addEventListener('ended', onEnded, { once: true })
          media.addEventListener('error', onError, { once: true })
          void media.play().catch(reject)
        })
      }
      setPlayed(true)
      setStatus('idle')
    } catch {
      setStatus('error')
    }
  }

  return (
    <div className={compact ? 'audio-wrap is-compact' : 'audio-wrap'}>
      <button
        type="button"
        className="audio-button"
        data-audio-id={asset.id}
        data-audio-sources={asset.sources.join('|')}
        aria-label={`${label}; listen or Replay`}
        onClick={() => void play()}
      >
        <span className="audio-symbol" aria-hidden="true">▶</span>
        <span>{played ? 'Replay' : label}</span>
      </button>
      <audio ref={mediaRef} hidden preload="auto" data-audio-media-id={asset.id} />
      {status === 'loading' ? <span className="audio-status">Loading…</span> : null}
      {status === 'error' ? (
        <div className="technical-error" role="alert">
          <span>This audio couldn’t load.</span>
          <button type="button" className="text-button" onClick={() => void play()}>
            Try again
          </button>
        </div>
      ) : null}
    </div>
  )
}

function FocusWord({ focus }: { focus?: CoreGrapheme }) {
  return (
    <div className="focus-word" lang="uk" aria-label="Привіт">
      {WORD.map((letter, index) => (
        <span className={letter === focus ? 'is-focused' : ''} key={`${letter}-${index}`}>
          {letter}
        </span>
      ))}
    </div>
  )
}

function AudioChoiceRow({
  audioId,
  label,
  onChoose,
}: {
  audioId: AudioId
  label: string
  onChoose: () => void
}) {
  return (
    <div className="sound-option">
      <AudioButton audioId={audioId} label={label} compact />
      <button type="button" className="choose-sound" onClick={onChoose}>
        Choose
      </button>
    </div>
  )
}

function ContextTile({
  index,
  onChoose,
}: {
  index: number
  onChoose: () => void
}) {
  const context = CONTEXTS[index]!
  return (
    <button
      type="button"
      className="context-tile"
      aria-label={context.label}
      onClick={onChoose}
    >
      <span
        className="context-image"
        aria-hidden="true"
        style={{ backgroundPosition: context.position }}
      />
      <span className="context-number" aria-hidden="true">{index + 1}</span>
    </button>
  )
}

function remaining(bank: readonly CoreGrapheme[], sequence: readonly CoreGrapheme[]) {
  return bank.filter((item) => !sequence.includes(item))
}

function prefixIsCorrect(sequence: readonly CoreGrapheme[]) {
  return sequence.every((item, index) => item === WORD[index])
}

function viewProgress(view: View) {
  if (view.kind === 'encounter') return 1
  if (view.kind.startsWith('mapping')) return 2
  if (view.kind.startsWith('vowel')) return 3
  if (view.kind === 'supported-build' || view.kind === 'reduced-build') return 4
  if (view.kind === 'context-return') return 5
  return 6
}

export function Lesson1() {
  const [view, setView] = useState<View>({ kind: 'encounter' })
  const [history, setHistory] = useState<View[]>([])
  const [feedback, setFeedback] = useState<'idle' | 'correct' | 'retry'>('idle')
  const [supportedSequence, setSupportedSequence] = useState<CoreGrapheme[]>([])
  const [reducedSequence, setReducedSequence] = useState<CoreGrapheme[]>([])
  const [supportedHelp, setSupportedHelp] = useState(false)
  const [reducedHelp, setReducedHelp] = useState(false)
  const [vowelHelp, setVowelHelp] = useState(false)
  const [contextHelp, setContextHelp] = useState(false)
  const headingRef = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    headingRef.current?.focus()
  }, [view])

  function navigate(next: View) {
    setHistory((current) => [...current, view])
    setView(next)
    setFeedback('idle')
  }

  function back() {
    setHistory((current) => {
      const previous = current.at(-1)
      if (!previous) return current
      setView(previous)
      setFeedback('idle')
      return current.slice(0, -1)
    })
  }

  function mappingSuccess(index: number, lowercase = false) {
    setFeedback('correct')
    window.setTimeout(() => {
      setFeedback('idle')
      if (index === 0 && !lowercase) {
        navigate({ kind: 'mapping-guided', index: 0, lowercase: true })
      } else if (index === 0 && lowercase) {
        navigate({ kind: 'mapping-retrieve-p' })
      } else if (index < MAPPINGS.length - 1) {
        navigate({ kind: 'mapping-teach', index: index + 1 })
      } else {
        navigate({ kind: 'vowel-compare' })
      }
    }, 280)
  }

  function renderFeedback() {
    return (
      <div className="feedback" aria-live="polite">
        {feedback === 'correct' ? <span className="feedback-good">✓ Yes.</span> : null}
        {feedback === 'retry' ? <span>Not yet. Try again.</span> : null}
      </div>
    )
  }

  const progress = viewProgress(view)

  return (
    <main className="lesson-shell">
      <header className="lesson-topbar">
        <div className="topbar-row">
          {history.length > 0 ? (
            <button type="button" className="back-button" onClick={back} aria-label="Back">
              <span aria-hidden="true">←</span> Back
            </button>
          ) : <span />}
          <div className="lesson-identity">Lesson 1 · First greeting</div>
        </div>
        <div className="progress-track" aria-label={`Lesson progress: ${progress} of 6`}>
          <span style={{ width: `${(progress / 6) * 100}%` }} />
        </div>
      </header>

      <div className="lesson-stage">
        {view.kind === 'encounter' ? (
          <section className="lesson-card encounter-card" data-view="encounter">
            <p className="eyebrow">A first Ukrainian greeting</p>
            <h1 ref={headingRef} tabIndex={-1} className="hero-word" lang="uk">Привіт</h1>
            <div className="anchor-media">
              <img
                src="/media/lesson1/L1-01_anchor_greeting.webp"
                alt="Two familiar people meet. One smiles and raises a hand while speaking to the other."
              />
            </div>
            <AudioButton audioId="contextualTarget" label="Listen" />
            <button type="button" className="primary-button" onClick={() => navigate({ kind: 'mapping-teach', index: 0 })}>
              Continue
            </button>
          </section>
        ) : null}

        {view.kind === 'mapping-teach' ? (() => {
          const mapping = MAPPINGS[view.index]!
          return (
            <section className="lesson-card" data-view="mapping-teach">
              <p className="eyebrow">Hear it inside the word</p>
              <h1 ref={headingRef} tabIndex={-1}>Listen to this sound</h1>
              <FocusWord focus={mapping.grapheme} />
              {view.index === 0 ? (
                <div className="case-pair" aria-label="Uppercase and lowercase forms" lang="uk">
                  <span>П</span><span>п</span>
                </div>
              ) : null}
              <AudioButton audioId={mapping.audio} label="Listen" />
              <button type="button" className="primary-button" onClick={() => navigate({ kind: 'mapping-guided', index: view.index })}>
                Try it
              </button>
            </section>
          )
        })() : null}

        {view.kind === 'mapping-guided' ? (() => {
          const mapping = MAPPINGS[view.index]!
          const isLower = view.lowercase === true
          const choices: readonly Grapheme[] = isLower ? ['п', 'т', 'в'] : mapping.guidedChoices
          const correct: Grapheme = isLower ? 'п' : mapping.grapheme
          return (
            <section className="lesson-card" data-view="mapping-guided">
              <p className="eyebrow">Use the sound you just heard</p>
              <h1 ref={headingRef} tabIndex={-1}>Tap the letter you hear</h1>
              <AudioButton audioId={mapping.audio} label="Listen" />
              <div className="grapheme-bank" role="group" aria-label="Letter choices">
                {choices.map((choice) => (
                  <button
                    type="button"
                    className="grapheme-button"
                    lang="uk"
                    key={choice}
                    onClick={() => choice === correct ? mappingSuccess(view.index, isLower) : setFeedback('retry')}
                  >
                    {choice}
                  </button>
                ))}
              </div>
              {renderFeedback()}
              <details className="local-help">
                <summary>Help</summary>
                <div className="help-content">
                  <AudioButton audioId={mapping.audio} label="Hear it again" compact />
                </div>
              </details>
            </section>
          )
        })() : null}

        {view.kind === 'mapping-retrieve-p' ? (
          <section className="lesson-card" data-view="mapping-retrieve">
            <p className="eyebrow">One more way</p>
            <h1 ref={headingRef} tabIndex={-1}>Choose the sound for <span lang="uk">П</span></h1>
            <div className="audio-choice-list" role="group" aria-label="Sound choices">
              <AudioChoiceRow audioId="t" label="Sound A" onChoose={() => setFeedback('retry')} />
              <AudioChoiceRow audioId="p" label="Sound B" onChoose={() => {
                setFeedback('correct')
                window.setTimeout(() => navigate({ kind: 'mapping-teach', index: 1 }), 280)
              }} />
            </div>
            {renderFeedback()}
            <details className="local-help">
              <summary>Help</summary>
              <div className="help-content">
                <FocusWord focus="П" />
                <AudioButton audioId="p" label="Hear it again" compact />
              </div>
            </details>
          </section>
        ) : null}

        {view.kind === 'vowel-compare' ? (
          <section className="lesson-card" data-view="vowel-compare">
            <p className="eyebrow">Two sounds in <span lang="uk">Привіт</span></p>
            <h1 ref={headingRef} tabIndex={-1}>Listen and compare</h1>
            <div className="vowel-compare">
              <div className="vowel-card">
                <span lang="uk">и</span>
                <AudioButton audioId="y" label="Listen" compact />
              </div>
              <div className="vowel-card">
                <span lang="uk">і</span>
                <AudioButton audioId="i" label="Listen" compact />
              </div>
            </div>
            <button type="button" className="primary-button" onClick={() => navigate({ kind: 'vowel-trial', index: 0 })}>
              Try it
            </button>
          </section>
        ) : null}

        {view.kind === 'vowel-trial' ? (() => {
          const trial = VOWEL_TRIALS[view.index]!
          const next = () => {
            setFeedback('correct')
            window.setTimeout(() => {
              if (view.index < VOWEL_TRIALS.length - 1) {
                navigate({ kind: 'vowel-trial', index: view.index + 1 })
              } else {
                navigate({ kind: 'supported-build' })
              }
            }, 280)
          }
          return (
            <section className="lesson-card" data-view="vowel-trial">
              <p className="eyebrow">Compare <span lang="uk">и</span> and <span lang="uk">і</span></p>
              <h1 ref={headingRef} tabIndex={-1}>
                {trial.direction === 'sound-print' ? 'Tap the letter you hear' : <>Choose the sound for <span lang="uk">{trial.grapheme}</span></>}
              </h1>
              {trial.direction === 'sound-print' ? (
                <>
                  <AudioButton audioId={trial.audio} label="Listen" />
                  <div className="grapheme-bank" role="group" aria-label="Vowel choices">
                    {(['и', 'і'] as const).map((choice) => (
                      <button
                        type="button"
                        className="grapheme-button"
                        lang="uk"
                        key={choice}
                        onClick={() => choice === trial.grapheme ? next() : setFeedback('retry')}
                      >
                        {choice}
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <div className="audio-choice-list" role="group" aria-label="Sound choices">
                  <AudioChoiceRow audioId={trial.grapheme === 'и' ? 'i' : 'y'} label="Sound A" onChoose={() => setFeedback('retry')} />
                  <AudioChoiceRow audioId={trial.audio} label="Sound B" onChoose={next} />
                </div>
              )}
              {renderFeedback()}
              <div className="help-toggle">
                <button type="button" className="text-button" onClick={() => setVowelHelp((open) => !open)}>
                  {vowelHelp ? 'Close help' : 'Help'}
                </button>
                {vowelHelp ? (
                  <div className="compact-help" aria-label="Compare again">
                    <span>Compare again</span>
                    <AudioButton audioId="y" label="и" compact />
                    <AudioButton audioId="i" label="і" compact />
                  </div>
                ) : null}
              </div>
            </section>
          )
        })() : null}

        {view.kind === 'supported-build' ? (
          <section className="lesson-card" data-view="supported-build">
            <p className="eyebrow">Put it together</p>
            <h1 ref={headingRef} tabIndex={-1}>Build the word</h1>
            <FocusWord />
            <AudioButton audioId="neutralTarget" label="Listen" compact />
            <div className="build-line" aria-label={`${supportedSequence.length} of 6 letters placed`}>
              {WORD.map((_, index) => <span key={index} lang="uk">{supportedSequence[index] ?? ''}</span>)}
            </div>
            <div className="grapheme-bank" role="group" aria-label="Build the word">
              {remaining(SUPPORTED_BANK, supportedSequence).map((choice) => (
                <button
                  className="grapheme-button"
                  type="button"
                  lang="uk"
                  key={choice}
                  onClick={() => {
                    if (choice !== WORD[supportedSequence.length]) {
                      setFeedback('retry')
                      return
                    }
                    setSupportedSequence((current) => [...current, choice])
                    setFeedback('correct')
                  }}
                >
                  {choice}
                </button>
              ))}
            </div>
            {renderFeedback()}
            <div className="help-toggle">
              <button type="button" className="text-button" onClick={() => setSupportedHelp((open) => !open)}>
                {supportedHelp ? 'Close help' : 'Help'}
              </button>
              {supportedHelp && supportedSequence.length < WORD.length ? (
                <div className="compact-help">
                  <AudioButton audioId={AUDIO_FOR[WORD[supportedSequence.length]!]} label="Hear the next sound" compact />
                </div>
              ) : null}
            </div>
            {supportedSequence.length === WORD.length ? (
              <button type="button" className="primary-button" onClick={() => navigate({ kind: 'reduced-build' })}>
                Continue
              </button>
            ) : null}
          </section>
        ) : null}

        {view.kind === 'reduced-build' ? (
          <section className="lesson-card" data-view="reduced-build">
            <p className="eyebrow">Now with less support</p>
            <h1 ref={headingRef} tabIndex={-1}>Build it again</h1>
            <div className="build-line" aria-label={`${reducedSequence.length} of 6 letters placed`}>
              {WORD.map((_, index) => <span key={index} lang="uk">{reducedSequence[index] ?? ''}</span>)}
            </div>
            <div className="grapheme-bank" role="group" aria-label="Build the word">
              {remaining(REDUCED_BANK, reducedSequence).map((choice) => (
                <button
                  className="grapheme-button"
                  type="button"
                  lang="uk"
                  key={choice}
                  onClick={() => {
                    setReducedSequence((current) => [...current, choice])
                    setFeedback('idle')
                  }}
                >
                  {choice}
                </button>
              ))}
            </div>
            <div className="build-actions">
              <button
                type="button"
                className="secondary-button"
                disabled={reducedSequence.length === 0}
                onClick={() => setReducedSequence((current) => current.slice(0, -1))}
              >
                Undo
              </button>
              <button
                type="button"
                className="primary-button is-compact"
                disabled={reducedSequence.length !== WORD.length}
                onClick={() => {
                  const correct = reducedSequence.every((item, index) => item === WORD[index])
                  setFeedback(correct ? 'correct' : 'retry')
                }}
              >
                Check
              </button>
            </div>
            {renderFeedback()}
            {feedback === 'retry' ? (
              <button type="button" className="secondary-button" onClick={() => {
                setReducedSequence([])
                setFeedback('idle')
              }}>
                Try again
              </button>
            ) : null}
            <div className="help-toggle">
              <button type="button" className="text-button" onClick={() => setReducedHelp((open) => !open)}>
                {reducedHelp ? 'Close help' : 'Help'}
              </button>
              {reducedHelp ? (
                <div className="compact-help">
                  {prefixIsCorrect(reducedSequence) && reducedSequence.length < WORD.length ? (
                    <AudioButton audioId={AUDIO_FOR[WORD[reducedSequence.length]!]} label="Hear the next sound" compact />
                  ) : (
                    <span>Undo the last letter and listen from there.</span>
                  )}
                </div>
              ) : null}
            </div>
            {feedback === 'correct' ? (
              <button type="button" className="primary-button" onClick={() => navigate({ kind: 'context-return' })}>
                Continue
              </button>
            ) : null}
          </section>
        ) : null}

        {view.kind === 'context-return' ? (
          <section className="lesson-card context-card" data-view="context-return">
            <p className="eyebrow">A new moment</p>
            <h1 ref={headingRef} tabIndex={-1}>Read. Choose the greeting moment.</h1>
            <div className="context-target" lang="uk">Привіт</div>
            <div className="context-grid" role="group" aria-label="Choose the greeting moment">
              {CONTEXTS.map((_, index) => (
                <ContextTile
                  index={index}
                  key={index}
                  onChoose={() => setFeedback(index === 1 ? 'correct' : 'retry')}
                />
              ))}
            </div>
            {renderFeedback()}
            <div className="help-toggle">
              <button type="button" className="text-button" onClick={() => setContextHelp((open) => !open)}>
                {contextHelp ? 'Close help' : 'Help'}
              </button>
              {contextHelp ? (
                <div className="compact-help">
                  <AudioButton audioId="neutralTarget" label="Hear the word" compact />
                </div>
              ) : null}
            </div>
            {feedback === 'correct' ? (
              <button type="button" className="primary-button" onClick={() => navigate({ kind: 'complete' })}>
                Continue
              </button>
            ) : null}
          </section>
        ) : null}

        {view.kind === 'complete' ? (
          <section className="lesson-card completion-card" data-view="complete">
            <div className="completion-mark" aria-hidden="true">✓</div>
            <p className="eyebrow">Lesson complete</p>
            <h1 ref={headingRef} tabIndex={-1} className="completion-word" lang="uk">Привіт</h1>
            <p className="completion-lead">You worked with one Ukrainian greeting from meaning to print.</p>
            <div className="completion-recap" aria-label="What you worked with">
              <span>Heard it in a greeting</span>
              <span>Connected sounds and letters</span>
              <span>Built and read the word</span>
            </div>
            <button type="button" className="primary-button">Finish lesson</button>
          </section>
        ) : null}
      </div>
    </main>
  )
}
