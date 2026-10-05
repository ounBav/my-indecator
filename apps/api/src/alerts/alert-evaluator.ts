import { AlertCondition } from './alerts.dto.js'

export function evaluateAlert(condition: AlertCondition, threshold: number, current: number, previous?: number): boolean {
  switch (condition) {
    case AlertCondition.PRICE_GT: return current > threshold
    case AlertCondition.PRICE_LT: return current < threshold
    case AlertCondition.PRICE_GTE: return current >= threshold
    case AlertCondition.PRICE_LTE: return current <= threshold
    case AlertCondition.CROSSES_ABOVE: return previous !== undefined && previous <= threshold && current > threshold
    case AlertCondition.CROSSES_BELOW: return previous !== undefined && previous >= threshold && current < threshold
    case AlertCondition.VOLUME_GT: return current > threshold
  }
}