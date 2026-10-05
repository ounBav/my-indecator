import { describe, expect, it } from 'vitest'
import type { Candle } from '../types/market'
import { bollinger, ema, macd, rsi, sma, vwap } from './indicators'
import { createDemoCandles } from './market'

const candles: Candle[] = Array.from({ length: 40 }, (_, index) => {
  const close = index + 1
  return { time: (1_700_000_000 + index * 60) as Candle['time'], open: close, high: close + 1, low: close - 1, close, volume: 100 + index }
})

describe('technical indicators', () => {
  it('generates chart timestamps in epoch seconds', () => {
    const lastTime = Number(createDemoCandles(2, 100, '1D').at(-1)!.time)
    expect(lastTime).toBeGreaterThan(1_700_000_000)
    expect(lastTime).toBeLessThan(4_102_444_800)
  })

  it('calculates a rolling simple moving average', () => {
    expect(sma(candles, 3).slice(0, 2)).toEqual([
      { time: candles[2]!.time, value: 2 },
      { time: candles[3]!.time, value: 3 },
    ])
  })

  it('seeds an exponential moving average from the first close', () => {
    const values = ema(candles.slice(0, 3), 2).map((point) => point.value)
    expect(values[0]).toBeCloseTo(1.6667, 4)
    expect(values[1]).toBeCloseTo(2.5556, 4)
  })

  it('returns 100 RSI for a monotonic gain-only window', () => {
    expect(rsi(candles, 14).at(-1)?.value).toBe(100)
  })

  it('produces ordered upper and lower Bollinger bands', () => {
    const [middle, upper, lower] = bollinger(candles, 5)
    expect(middle.length).toBe(36)
    expect(upper[0]!.value).toBeGreaterThan(middle[0]!.value)
    expect(lower[0]!.value).toBeLessThan(middle[0]!.value)
  })

  it('calculates a volume-weighted average and MACD signal lines', () => {
    expect(vwap(candles)).toHaveLength(candles.length)
    expect(macd(candles).every((line) => line.length > 0)).toBe(true)
  })
})
