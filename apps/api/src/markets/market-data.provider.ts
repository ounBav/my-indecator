export type MarketSymbol = {
  symbol: string
  name: string
  exchange: string
  currency: string
  price: number
  changePercent: number
  volume: number
}

export type MarketCandle = {
  time: number
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export interface MarketDataProvider {
  getSymbols(): Promise<MarketSymbol[]>
  getHistoricalCandles(symbol: string, timeframe: string, limit: number): Promise<MarketCandle[]>
  subscribe(symbol: string, onCandle: (candle: MarketCandle) => void): Promise<void>
  unsubscribe(symbol: string): Promise<void>
}

export const MARKET_DATA_PROVIDER = Symbol('MARKET_DATA_PROVIDER')

export function isValidCandle(candle: MarketCandle): boolean {
  return Number.isFinite(candle.time) && candle.time > 0 &&
    [candle.open, candle.high, candle.low, candle.close, candle.volume].every(Number.isFinite) &&
    candle.open > 0 && candle.high >= Math.max(candle.open, candle.close, candle.low) &&
    candle.low <= Math.min(candle.open, candle.close) && candle.volume >= 0
}