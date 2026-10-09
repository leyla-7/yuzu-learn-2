import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { Module1LessonApp } from './Module1LessonApp'
import {
  DEFERRED_W2_AUDIO_SEAMS,
  EXTERNAL_MEDIA_SEAMS,
  LESSON_STATE_SEQUENCES,
  MODULE1_AUDIO_BINDINGS,
} from './browser-spec'
import {
  browserSessionAtState,
  decodeBrowserLessonSession,
  encodeBrowserLessonSession,
} from './browser-session'

describe('WORK-YUZU-085 browser bindings', () => {
  it('preserves the exact L2/L3/L4 state sequence', () => {
    expect(LESSON_STATE_SEQUENCES['lesson-2'].map((state) => state.id)).toEqual([
      'l2-s01',
      'l2-s02',
      'l2-s03',
      'l2-s04',
      'l2-s05',
      'l2-s06',
      'l2-s07',
    ])
    expect(LESSON_STATE_SEQUENCES['lesson-3'].map((state) => state.id)).toEqual([
      'l3-s01',
      'l3-s02',
      'l3-s03',
      'l3-s04',
      'l3-s05',
      'l3-s06',
    ])
    expect(LESSON_STATE_SEQUENCES['lesson-4'].map((state) => state.id)).toEqual([
      'l4-s01',
      'l4-s02',
      'l4-s03',
      'l4-s04',
      'l4-s05',
    ])
  })

  it('binds only accepted W1 audio and leaves every W2 role symbolic', () => {
    const w1 = Object.values(MODULE1_AUDIO_BINDINGS).filter((binding) =>
      binding.role.startsWith('w1-'),
    )
    expect(w1.every((binding) => binding.status === 'bound-existing-w1')).toBe(true)
    expect(w1.every((binding) => binding.src?.startsWith('/audio/lesson1/'))).toBe(true)

    const w2 = Object.values(MODULE1_AUDIO_BINDINGS).filter((binding) =>
      binding.role.startsWith('w2-'),
    )
    expect(w2.every((binding) => binding.status === 'deferred-symbolic-w2')).toBe(true)
    expect(w2.every((binding) => binding.src === null)).toBe(true)
    expect(DEFERRED_W2_AUDIO_SEAMS).toEqual([
      'AUD-M1-L2-W2-CONTEXT-BUVAI',
      'AUD-M1-W2-NEUTRAL-BUVAI',
      'MAP-Б',
      'MAP-у',
      'MAP-а',
      'MAP-й',
    ])
  })

  it('keeps concrete media asset bytes external while defining every media slot', () => {
    expect(EXTERNAL_MEDIA_SEAMS.length).toBeGreaterThan(20)
    expect(new Set(EXTERNAL_MEDIA_SEAMS).size).toBe(EXTERNAL_MEDIA_SEAMS.length)
    expect(EXTERNAL_MEDIA_SEAMS.every((slot) => slot.startsWith('MEDIA-M1-'))).toBe(true)
  })

  it('round-trips the exact browser-safe resume state and fails closed on corrupt input', () => {
    const session = browserSessionAtState('lesson-3', 'l3-s04', {
      itemIndex: 1,
      opportunities: {
        'changed-context-w1-w2-retrieval': 'presented',
        'listening-without-answer-print': 'presented',
      },
    })
    expect(
      decodeBrowserLessonSession(
        encodeBrowserLessonSession(session),
        'lesson-3',
      ),
    ).toEqual(session)

    expect(
      decodeBrowserLessonSession('{broken', 'lesson-3').stateId,
    ).toBe('l3-s01')
  })

  it('server-renders protected listening without answer-bearing print', () => {
    const session = browserSessionAtState('lesson-3', 'l3-s02')
    const markup = renderToStaticMarkup(
      <Module1LessonApp
        lessonId="lesson-3"
        mode="resume"
        resumePoint={encodeBrowserLessonSession(session)}
        useNonvisualAlternatives={false}
      />,
    )

    expect(markup).toContain('data-listening-protected="true"')
    expect(markup).toContain('data-answer-print-visible="false"')
    expect(markup).not.toContain('class="target-word"')
  })

  it('renders the reduced-support nonvisual route without target-length slots', () => {
    const session = browserSessionAtState('lesson-4', 'l4-s02')
    const markup = renderToStaticMarkup(
      <Module1LessonApp
        lessonId="lesson-4"
        mode="resume"
        resumePoint={encodeBrowserLessonSession(session)}
        useNonvisualAlternatives
      />,
    )

    expect(markup).toContain('data-target-length-support="false"')
    expect(markup).toContain('construction-build-area')
    expect(markup).not.toContain('construction-slots')
  })

  it('renders L2 supported construction with five slots and exact taught pool', () => {
    const session = browserSessionAtState('lesson-2', 'l2-s06')
    const markup = renderToStaticMarkup(
      <Module1LessonApp
        lessonId="lesson-2"
        mode="resume"
        resumePoint={encodeBrowserLessonSession(session)}
        useNonvisualAlternatives={false}
      />,
    )

    expect(markup).toContain('data-target-length-support="true"')
    expect(markup.match(/class="construction-slot"/g)?.length).toBe(5)
    for (const grapheme of ['Б', 'у', 'в', 'а', 'й']) {
      expect(markup).toContain(`>${grapheme}</button>`)
    }
  })
})
