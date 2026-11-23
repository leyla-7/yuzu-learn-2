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

  it('binds the accepted Lesson-1 audio package to the existing runtime seams', () => {
    expect(LESSON1_AUDIO_ASSETS).toMatchObject({
      contextualTarget: { sources: ['/audio/lesson1/1.m4a'] },
      neutralTarget: { sources: ['/audio/lesson1/2.m4a'] },
      p: { sources: ['/audio/lesson1/3.m4a'] },
      r: { sources: ['/audio/lesson1/4.m4a'] },
      y: { sources: ['/audio/lesson1/5.m4a'] },
      v: { sources: ['/audio/lesson1/6.m4a'] },
      i: { sources: ['/audio/lesson1/7.m4a'] },
      t: { sources: ['/audio/lesson1/8.m4a'] },
      beginningPr: {
        status: 'accepted-component-sequence',
        sources: ['/audio/lesson1/3.m4a', '/audio/lesson1/4.m4a'],
      },
      l9Target: { sources: ['/audio/lesson1/12.m4a'] },
      l9F1: { sources: ['/audio/lesson1/13.m4a'] },
      l9F2: { sources: ['/audio/lesson1/14.m4a'] },
    })

    const serialized = JSON.stringify(LESSON1_AUDIO_ASSETS)
    expect(serialized).not.toContain('/audio/lesson1/9.m4a')
    expect(serialized).not.toContain('/audio/lesson1/10.m4a')
    expect(serialized).not.toContain('pending-13')
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
