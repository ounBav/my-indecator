import { describe, expect, it } from 'vitest'
import { AlertCondition } from './alerts.dto.js'
import { evaluateAlert } from './alert-evaluator.js'

describe('evaluateAlert', () => {
  it.each([
    [AlertCondition.PRICE_GT, 102, 101, true],
    [AlertCondition.PRICE_LT, 99, 101, true],
    [AlertCondition.PRICE_GTE, 101, 101, true],
    [AlertCondition.PRICE_LTE, 101, 101, true],
    [AlertCondition.VOLUME_GT, 102, 101, true],
  ] as const)('evaluates %s against its threshold', (condition, current, threshold, expected) => {
    expect(evaluateAlert(condition, threshold, current)).toBe(expected)
  })
  it('requires an observed prior price for cross conditions', () => {
    expect(evaluateAlert(AlertCondition.CROSSES_ABOVE, 100, 101)).toBe(false)
    expect(evaluateAlert(AlertCondition.CROSSES_ABOVE, 100, 101, 99)).toBe(true)
    expect(evaluateAlert(AlertCondition.CROSSES_BELOW, 100, 99, 101)).toBe(true)
    expect(evaluateAlert(AlertCondition.CROSSES_BELOW, 100, 101, 102)).toBe(false)
  })
})