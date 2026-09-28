import { describe, expect, it } from 'vitest'
import {
  ACCESSIBLE_L9_HELP_TRIGGERS,
  BUILD_PASS_CONFIGS,
  LESSON1_AUDIO_ASSETS,
  LESSON1_BROWSER_STEPS,
  createMappingPractice,
  createVowelPractice,
  getVisualL9Options,
  scheduleAdaptiveRetry,
} from './browser-model'

describe('WORK-YUZU-063 browser implementation model', () => {
  it('keeps the accepted eight learner-facing steps in order', () => {
    expect(LESSON1_BROWSER_STEPS).toEqual([
      'meet',
      'temporal-choice',
      'mapping-practice',
      'vowel-practice',
      'build-read',
      'l9',
      'fresh-context',
      'complete',
    ])
  })

  it('exposes every required audio seam as pending 13 asset validation', () => {
    expect(Object.keys(LESSON1_AUDIO_ASSETS)).toEqual([
      'contextualTarget',
      'neutralTarget',
      'p',
      'r',
      'y',
      'v',
      'i',
      't',
      'beginningPr',
      'l9Target',
      'l9F1',
      'l9F2',
    ])
    expect(
      Object.values(LESSON1_AUDIO_ASSETS).every(
        (asset) => asset.status === 'pending-13',
      ),
    ).toBe(true)
  })

  it('requires active sound-to-print and print-to-sound work for every mapping', () => {
    const trials = createMappingPractice()
    const byMapping = new Map<string, Set<string>>()

    for (const trial of trials) {
      const directions = byMapping.get(trial.mappingId) ?? new Set<string>()
      directions.add(trial.direction)
      byMapping.set(trial.mappingId, directions)
    }

    expect([...byMapping.values()].every((directions) =>
      directions.has('sound-to-grapheme') &&
      directions.has('grapheme-to-sound'),
    )).toBe(true)
  })

  it('keeps mapping practice bounded while allowing unstable mappings one local retry', () => {
    const trials = createMappingPractice()
    const failed = trials[0]!
    const withRetry = scheduleAdaptiveRetry(trials, failed, 0)
    const capped = scheduleAdaptiveRetry(withRetry, failed, 1)

    expect(withRetry).toHaveLength(trials.length + 1)
    expect(capped).toHaveLength(withRetry.length)
  })

  it('keeps vowel practice short and genuinely two-way', () => {
    const trials = createVowelPractice()
    expect(trials).toHaveLength(4)
    expect(new Set(trials.map((trial) => trial.direction))).toEqual(
      new Set(['sound-to-grapheme', 'grapheme-to-sound']),
    )
  })

  it('materially reduces automatic Build / Read support on the later pass', () => {
    expect(BUILD_PASS_CONFIGS[0]).toMatchObject({
      mode: 'supported',
      allowBeginningSupport: true,
      allowFullTargetReplay: true,
    })
    expect(BUILD_PASS_CONFIGS[1]).toMatchObject({
      mode: 'reduced',
      allowBeginningSupport: false,
      allowFullTargetReplay: false,
      targetReferenceVisible: false,
      automaticNextCue: false,
    })
  })

  it('keeps the beginning-support trigger neutral until the learner activates it', () => {
    expect(ACCESSIBLE_L9_HELP_TRIGGERS.beginning).toEqual({
      label: 'Listen',
      audioId: 'beginningPr',
    })
    expect(JSON.stringify(ACCESSIBLE_L9_HELP_TRIGGERS)).not.toContain('П + р')
    expect(JSON.stringify(ACCESSIBLE_L9_HELP_TRIGGERS)).not.toContain('Привіт')
  })

  it('keeps L9 foil spellings internal while binding the qualified audio identifiers', () => {
    expect(getVisualL9Options()).toEqual([
      { id: 'l9-target', audioId: 'l9Target', correct: true },
      { id: 'l9-f1', audioId: 'l9F1', correct: false },
      { id: 'l9-f2', audioId: 'l9F2', correct: false },
    ])
  })
})
