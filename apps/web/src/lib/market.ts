import type { Candle, Timeframe } from '../types/market'

const timeframeSeconds: Record<Timeframe, number> = {
  '1m': 60,
  '5m': 300,
  '15m': 900,
  '30m': 1800,
  '1h': 3600,
  '4h': 14400,
  '1D': 86400,
  '1W': 604800,
  '1M': 2592000,
}

export function createDemoCandles(count: number, lastPrice: number, timeframe: Timeframe = '1D'): Candle[] {
  const interval = timeframeSeconds[timeframe]
  const current = Math.floor(Date.now() / 1000 / interval) * interval
  let close = lastPrice * 0.82

  return Array.from({ length: count }, (_, index) => {
    const open = close
    const drift = Math.sin(index * 0.24) * 0.002 + (Math.random() - 0.48) * 0.014
    close = Math.max(lastPrice * 0.5, close * (1 + drift))
    const high = Math.max(open, close) * (1 + Math.random() * 0.006)
    const low = Math.min(open, close) * (1 - Math.random() * 0.006)
    const volume = Math.round(700_000 + Math.random() * 4_500_000)

    return {
      time: (current - (count - index - 1) * interval) as Candle['time'],
      open,
      high,
      low,
      close,
      volume,
    }
  }).map((candle, index, all) => index === all.length - 1 ? { ...candle, close: lastPrice, high: Math.max(candle.high, lastPrice) } : candle)
}

export function formatPrice(value: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(value)
}

export function formatCompact(value: number): string {
  return new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(value)
}