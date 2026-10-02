import { describe, expect, it } from 'vitest'
import {
  MODULE1_LESSON_RUNTIME_CONTRACTS,
  canEmitLessonComplete,
  createLessonCompleteDetail,
  createModule1CompletionUpdate,
  markOpportunityPresented,
  type OpportunityLedger,
} from './lesson-contracts'

describe('Module-1 L2-L4 runtime contracts', () => {
  it('locks the Product-level L2/L3/L4 capabilities without final task mechanics', () => {
    expect(
      MODULE1_LESSON_RUNTIME_CONTRACTS['lesson-2'].requiredCapabilities,
    ).toContain('supported-orthographic-construction')
    expect(
      MODULE1_LESSON_RUNTIME_CONTRACTS['lesson-3'].requiredCapabilities,
    ).toContain('listening-without-answer-print')
    expect(
      MODULE1_LESSON_RUNTIME_CONTRACTS['lesson-3'].requiredCapabilities,
    ).toContain('reading-without-auto-target-audio')
    expect(
      MODULE1_LESSON_RUNTIME_CONTRACTS['lesson-4']
        .emitsModuleCompletionUpdate,
    ).toBe(true)
  })

  it('requires only valid opportunity presentation, not perfect independent success, for Lesson completion', () => {
    const contract = MODULE1_LESSON_RUNTIME_CONTRACTS['lesson-2']
    let ledger: OpportunityLedger = {}

    for (const opportunity of contract.completionOpportunities) {
      ledger = markOpportunityPresented(ledger, opportunity)
    }

    expect(canEmitLessonComplete(contract, ledger)).toBe(true)
    expect(createLessonCompleteDetail(contract, ledger)).toEqual({
      lessonId: 'lesson-2',
    })
  })

  it('rejects a completion event while required Product opportunities are missing', () => {
    const contract = MODULE1_LESSON_RUNTIME_CONTRACTS['lesson-3']

    expect(canEmitLessonComplete(contract, {})).toBe(false)
    expect(() => createLessonCompleteDetail(contract, {})).toThrow(
      'cannot emit completion before all required opportunities were presented',
    )
  })

  it('updates Module-1 completion only after all four Lessons are complete', () => {
    expect(
      createModule1CompletionUpdate({
        'lesson-1': true,
        'lesson-2': true,
        'lesson-3': true,
        'lesson-4': false,
      }),
    ).toBeNull()

    expect(
      createModule1CompletionUpdate({
        'lesson-1': true,
        'lesson-2': true,
        'lesson-3': true,
        'lesson-4': true,
      }),
    ).toEqual({
      moduleId: 'module-1',
      complete: true,
      completedLessonIds: ['lesson-1', 'lesson-2', 'lesson-3', 'lesson-4'],
    })
  })

  it('keeps L3 target scope at W1/W2 only and introduces no W3', () => {
    expect(MODULE1_LESSON_RUNTIME_CONTRACTS['lesson-3'].targetIds).toEqual([
      'w1',
      'w2',
    ])
  })
})
