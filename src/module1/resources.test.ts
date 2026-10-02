import { describe, expect, it } from 'vitest'
import {
  DELTA_G2_GRAPHEMES,
  K1_GRAPHEMES,
  K2_GRAPHEMES,
  MODULE1_RESOURCE_SLOTS,
  MODULE1_TARGETS,
  REUSED_W2_GRAPHEMES,
  assertValidQualifiedBindings,
  getMissingRequiredBindings,
} from './resources'

describe('Module-1 language/resource contract', () => {
  it('locks W1/W2 without inventing W3 or broader language', () => {
    expect(MODULE1_TARGETS.w1.writtenForm).toBe('Привіт')
    expect(MODULE1_TARGETS.w2.writtenForm).toBe('Бувай')
    expect(MODULE1_TARGETS.w2.spokenStressReference).toBe('Бува́й')
    expect(Object.keys(MODULE1_TARGETS)).toEqual(['w1', 'w2'])
  })

  it('keeps K1, ΔG2, reused в and K2 bounded to taught glyphs', () => {
    expect(K1_GRAPHEMES).toEqual(['П', 'п', 'р', 'и', 'в', 'і', 'т'])
    expect(DELTA_G2_GRAPHEMES).toEqual(['Б', 'у', 'а', 'й'])
    expect(REUSED_W2_GRAPHEMES).toEqual(['в'])
    expect(K2_GRAPHEMES).toEqual([
      'П',
      'п',
      'р',
      'и',
      'в',
      'і',
      'т',
      'Б',
      'у',
      'а',
      'й',
    ])
    expect(K2_GRAPHEMES).not.toContain('б')
    expect(K2_GRAPHEMES).not.toContain('У')
    expect(K2_GRAPHEMES).not.toContain('А')
    expect(K2_GRAPHEMES).not.toContain('Й')
  })

  it('reflects 13-qualified W2 asset classes without inventing final files', () => {
    expect(MODULE1_RESOURCE_SLOTS.w2ContextualAudio.requirement).toBe('required')
    expect(MODULE1_RESOURCE_SLOTS.w2NeutralEvidenceAudio.requirement).toBe(
      'required',
    )
    expect(MODULE1_RESOURCE_SLOTS.reusedVInW2.requirement).toBe('conditional')
    expect(MODULE1_RESOURCE_SLOTS.w2SupportBu.requirement).toBe('conditional')
    expect(MODULE1_RESOURCE_SLOTS.w1TargetAudio.requirement).toBe(
      'reuse-existing',
    )
    expect(
      Object.values(MODULE1_RESOURCE_SLOTS).every(
        (slot) => slot.qualification === 'qualified-binding-required',
      ),
    ).toBe(true)
  })

  it('reports genuinely missing required W2 bindings while excluding conditional support', () => {
    const missing = getMissingRequiredBindings([])

    expect(missing).toContain('w2.contextual-target-audio')
    expect(missing).toContain('w2.neutral-evidence-audio')
    expect(missing).toContain('g2.Б.sound-model')
    expect(missing).toContain('g2.у.sound-model')
    expect(missing).toContain('g2.а.sound-model')
    expect(missing).toContain('g2.й.sound-model')
    expect(missing).not.toContain('w2.в.context-support')
    expect(missing).not.toContain('w2.support.Бу')
  })

  it('validates qualified bindings without accepting duplicates or empty resources', () => {
    expect(() =>
      assertValidQualifiedBindings([
        { slotId: 'w2.contextual-target-audio', resourceId: 'qualified-w2-audio' },
      ]),
    ).not.toThrow()

    expect(() =>
      assertValidQualifiedBindings([
        { slotId: 'w2.contextual-target-audio', resourceId: 'a' },
        { slotId: 'w2.contextual-target-audio', resourceId: 'b' },
      ]),
    ).toThrow('Duplicate Module-1 resource slot binding')

    expect(() =>
      assertValidQualifiedBindings([
        { slotId: 'w2.contextual-target-audio', resourceId: '   ' },
      ]),
    ).toThrow('is empty')
  })
})
