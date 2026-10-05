import type { Candle, Indicator, IndicatorPoint } from '../types/market'

function points(candles: readonly Candle[], values: (number | undefined)[]): IndicatorPoint[] {
  return candles.flatMap((candle, index) => {
    const value = values[index]
    return value === undefined || !Number.isFinite(value) ? [] : [{ time: candle.time, value }]
  })
}

export function sma(candles: readonly Candle[], period: number): IndicatorPoint[] {
  let sum = 0
  const values = candles.map((candle, index) => {
    sum += candle.close
    if (index >= period) sum -= candles[index - period]!.close
    return index >= period - 1 ? sum / period : undefined
  })
  return points(candles, values)
}

export function ema(candles: readonly Candle[], period: number): IndicatorPoint[] {
  const multiplier = 2 / (period + 1)
  let value: number | undefined
  const values = candles.map((candle, index) => {
    value = value === undefined ? candle.close : candle.close * multiplier + value * (1 - multiplier)
    return index >= period - 1 ? value : undefined
  })
  return points(candles, values)
}

export function rsi(candles: readonly Candle[], period = 14): IndicatorPoint[] {
  let averageGain = 0
  let averageLoss = 0
  const values: (number | undefined)[] = Array(candles.length).fill(undefined)
  for (let index = 1; index < candles.length; index++) {
    const difference = candles[index]!.close - candles[index - 1]!.close
    const gain = Math.max(difference, 0)
    const loss = Math.max(-difference, 0)
    if (index <= period) {
      averageGain += gain / period
      averageLoss += loss / period
    } else {
      averageGain = ((period - 1) * averageGain + gain) / period
      averageLoss = ((period - 1) * averageLoss + loss) / period
    }
    if (index >= period) values[index] = averageLoss === 0 ? 100 : 100 - 100 / (1 + averageGain / averageLoss)
  }
  return points(candles, values)
}

export function bollinger(candles: readonly Candle[], period = 20, deviations = 2): IndicatorPoint[][] {
  const center = sma(candles, period)
  const byTime = new Map(center.map((item) => [item.time, item.value]))
  const upper: IndicatorPoint[] = []
  const lower: IndicatorPoint[] = []
  for (let index = period - 1; index < candles.length; index++) {
    const window = candles.slice(index - period + 1, index + 1)
    const mean = byTime.get(candles[index]!.time)
    if (mean === undefined) continue
    const variance = window.reduce((sum, item) => sum + (item.close - mean) ** 2, 0) / period
    const spread = Math.sqrt(variance) * deviations
    upper.push({ time: candles[index]!.time, value: mean + spread })
    lower.push({ time: candles[index]!.time, value: mean - spread })
  }
  return [center, upper, lower]
}

export function vwap(candles: readonly Candle[]): IndicatorPoint[] {
  let cumulativeVolume = 0
  let cumulativeValue = 0
  return candles.map((candle) => {
    const typical = (candle.high + candle.low + candle.close) / 3
    cumulativeVolume += candle.volume
    cumulativeValue += typical * candle.volume
    return { time: candle.time, value: cumulativeValue / cumulativeVolume }
  })
}

export function macd(candles: readonly Candle[]): IndicatorPoint[][] {
  const fast = ema(candles, 12)
  const slow = ema(candles, 26)
  const fastMap = new Map(fast.map((item) => [item.time, item.value]))
  const line = slow.flatMap((item) => {
    const short = fastMap.get(item.time)
    return short === undefined ? [] : [{ time: item.time, value: short - item.value }]
  })
  const signalCandles = line.map((item) => ({ time: item.time, open: item.value, high: item.value, low: item.value, close: item.value, volume: 0 }))
  const signal = ema(signalCandles, 9)
  return [line, signal]
}

export const indicators: Indicator[] = [
  { id: 'SMA 50', label: 'SMA 50', calculate: (candles) => ({ name: 'SMA 50', lines: [sma(candles, 50)] }) },
  { id: 'EMA 20', label: 'EMA 20', calculate: (candles) => ({ name: 'EMA 20', lines: [ema(candles, 20)] }) },
  { id: 'RSI 14', label: 'RSI 14', calculate: (candles) => ({ name: 'RSI 14', lines: [rsi(candles)] }) },
  { id: 'MACD', label: 'MACD', calculate: (candles) => ({ name: 'MACD', lines: macd(candles) }) },
  { id: 'Bollinger Bands', label: 'Bollinger Bands', calculate: (candles) => ({ name: 'Bollinger Bands', lines: bollinger(candles) }) },
  { id: 'VWAP', label: 'VWAP', calculate: (candles) => ({ name: 'VWAP', lines: [vwap(candles)] }) },
]