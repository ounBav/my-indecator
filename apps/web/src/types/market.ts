import type { UTCTimestamp } from 'lightweight-charts'

export type Timeframe = '1m' | '5m' | '15m' | '30m' | '1h' | '4h' | '1D' | '1W' | '1M'
export type ChartType = 'Candles' | 'Line' | 'Area' | 'Bar'
export type Candle = {
  time: UTCTimestamp
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export type IndicatorPoint = { time: UTCTimestamp; value: number }
export type IndicatorResult = { name: string; lines: IndicatorPoint[][] }
export type Indicator = {
  id: string
  label: string
  calculate: (candles: readonly Candle[]) => IndicatorResult
}

export type Drawing = {
  id: string
  kind: 'horizontal' | 'vertical' | 'trend' | 'ray' | 'rectangle' | 'text'
  x1: number
  y1: number
  x2?: number
  y2?: number
  label?: string
}