import { describe, expect, it } from 'vitest'
import {
  MODULE1_CONSTRUCTION_CONTRACTS,
  appendConstructionGrapheme,
  createConstructionState,
  getConstructionPool,
  recordConstructionHelp,
  submitConstruction,
  undoConstructionGrapheme,
} from './construction'

describe('Module-1 orthographic construction contracts', () => {
  it('gives L2 target-length support but removes it for L3/L4', () => {
    expect(
      MODULE1_CONSTRUCTION_CONTRACTS['l2-w2-supported'].targetLengthSupport,
    ).toBe(true)
    expect(
      MODULE1_CONSTRUCTION_CONTRACTS['l3-w2-reduced'].targetLengthSupport,
    ).toBe(false)
    expect(
      MODULE1_CONSTRUCTION_CONTRACTS['l4-w2-low-support'].targetLengthSupport,
    ).toBe(false)
  })

  it('uses exact-target taught units for L2 and the broader K2 pool for L3/L4', () => {
    expect(
      getConstructionPool(MODULE1_CONSTRUCTION_CONTRACTS['l2-w2-supported']),
    ).toEqual(['Б', 'у', 'в', 'а', 'й'])

    const reducedPool = getConstructionPool(
      MODULE1_CONSTRUCTION_CONTRACTS['l3-w2-reduced'],
    )
    expect(reducedPool).toContain('П')
    expect(reducedPool).toContain('Б')
    expect(reducedPool).not.toContain('б')
  })

  it('provides Undo and only checks correctness on full submission', () => {
    const contract = MODULE1_CONSTRUCTION_CONTRACTS['l2-w2-supported']
    let state = createConstructionState(contract)

    for (const grapheme of ['Б', 'у', 'в', 'а', 'й'] as const) {
      state = appendConstructionGrapheme(state, contract, grapheme)
    }

    const submission = submitConstruction(state, contract)
    expect(submission.result).toEqual({
      correct: true,
      submittedSequence: 'Бувай',
    })
    expect(submission.state.submissionCount).toBe(1)

    const undone = undoConstructionGrapheme(state)
    expect(undone.sequence.join('')).toBe('Бува')
  })

  it('keeps per-placement correctness disabled across all construction contracts', () => {
    expect(
      Object.values(MODULE1_CONSTRUCTION_CONTRACTS).every(
        (contract) =>
          contract.perPlacementCorrectness === false &&
          contract.fullSequenceCheck === true &&
          contract.undoAllowed === true,
      ),
    ).toBe(true)
  })

  it('records Help and full-answer exposure without changing the built sequence', () => {
    const contract = MODULE1_CONSTRUCTION_CONTRACTS['l3-w1-reduced']
    let state = createConstructionState(contract)
    state = appendConstructionGrapheme(state, contract, 'П')
    state = recordConstructionHelp(state, 'full-answer')

    expect(state.sequence).toEqual(['П'])
    expect(state.helpLevel).toBe('full-answer')
    expect(state.fullAnswerExposed).toBe(true)
  })
})
