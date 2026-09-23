import { describe, expect, it } from 'vitest'
import {
  LESSON1_CONTENT_SLOT_IDS,
  LESSON1_EPISODE_IDS,
  LESSON1_MAPPING_IDS,
  LESSON1_PRODUCTION_FIXTURE,
} from './contracts'

describe('WORK-YUZU-063 Lesson 1 production contracts', () => {
  it('keeps the seven Product episodes in their approved order', () => {
    expect(LESSON1_EPISODE_IDS).toEqual([
      'episode-1-greeting-happens',
      'episode-2-discover-function',
      'episode-3-open-word',
      'episode-4-difficult-parts',
      'episode-5-reconstruct',
      'episode-6-reduced-reading',
      'episode-7-close-loop',
    ])
  })

  it('contains one locked lexical target and only the required mapping identifiers', () => {
    expect(LESSON1_PRODUCTION_FIXTURE.target).toEqual({
      id: 'privit',
      surface: 'Привіт',
      mappingIds: LESSON1_MAPPING_IDS,
    })
  })

  it('exposes C1-C7 as pending Content seams rather than learner-facing copy', () => {
    const contentInputs = LESSON1_PRODUCTION_FIXTURE.specialistInputs.filter(
      (input) => input.owner === '14',
    )

    expect(contentInputs.map((input) => input.id)).toEqual(
      LESSON1_CONTENT_SLOT_IDS.map((slot) => `content-${slot}`),
    )
    expect(contentInputs.every((input) => input.status === 'pending')).toBe(true)
  })

  it('keeps 21 and 22 realization inputs pending instead of guessing mechanics or presentation', () => {
    expect(LESSON1_PRODUCTION_FIXTURE.specialistInputs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'context-realization',
          owner: '21',
          status: 'pending',
        }),
        expect.objectContaining({
          id: 'ui-realization',
          owner: '22',
          status: 'pending',
        }),
      ]),
    )
  })

  it('keeps audio references pending 13 qualification without inventing final alternatives', () => {
    expect(
      LESSON1_PRODUCTION_FIXTURE.audio.every(
        (audio) => audio.qualification === 'pending-13',
      ),
    ).toBe(true)

    expect(LESSON1_PRODUCTION_FIXTURE.audio.map((audio) => audio.purpose)).toEqual([
      'target',
      'component-mapping',
      'vowel-contrast',
      'cluster',
      'reading-alternatives',
    ])
  })
})
