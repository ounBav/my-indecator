import { Injectable } from '@nestjs/common'
import type { MarketCandle, MarketDataProvider, MarketSymbol } from './market-data.provider.js'

@Injectable()
export class DemoMarketDataProvider implements MarketDataProvider {
  private readonly catalog: MarketSymbol[] = [
    { symbol: 'NVDA', name: 'NVIDIA Corporation', exchange: 'NASDAQ', currency: 'USD', price: 142.87, changePercent: 2.41, volume: 38_200_000 },
    { symbol: 'AAPL', name: 'Apple Inc.', exchange: 'NASDAQ', currency: 'USD', price: 248.5, changePercent: 0.74, volume: 21_600_000 },
    { symbol: 'MSFT', name: 'Microsoft Corporation', exchange: 'NASDAQ', currency: 'USD', price: 512.16, changePercent: -0.32, volume: 12_300_000 },
    { symbol: 'TSLA', name: 'Tesla, Inc.', exchange: 'NASDAQ', currency: 'USD', price: 327.63, changePercent: 1.86, volume: 54_100_000 },
    { symbol: 'AMZN', name: 'Amazon.com, Inc.', exchange: 'NASDAQ', currency: 'USD', price: 231.44, changePercent: -1.08, volume: 17_800_000 },
    { symbol: 'GOOGL', name: 'Alphabet Inc.', exchange: 'NASDAQ', currency: 'USD', price: 184.03, changePercent: 0.55, volume: 9_400_000 },
    { symbol: 'META', name: 'Meta Platforms, Inc.', exchange: 'NASDAQ', currency: 'USD', price: 736.21, changePercent: 1.23, volume: 6_700_000 },
  ]
  private readonly subscriptions = new Map<string, ReturnType<typeof setInterval>>()

  async getSymbols(): Promise<MarketSymbol[]> { return this.catalog.map((item) => ({ ...item })) }

  async getHistoricalCandles(symbol: string, timeframe: string, limit: number): Promise<MarketCandle[]> {
    const item = this.catalog.find((candidate) => candidate.symbol === symbol)
    if (!item) return []
    const interval = timeframe === '1m' ? 60 : timeframe === '5m' ? 300 : timeframe === '15m' ? 900 : timeframe === '30m' ? 1800 : timeframe === '1h' ? 3600 : timeframe === '4h' ? 14400 : timeframe === '1W' ? 604800 : timeframe === '1M' ? 2592000 : 86400
    const end = Math.floor(Date.now() / 1000 / interval) * interval
    let close = item.price * 0.83
    return Array.from({ length: limit }, (_, index) => {
      const open = close
      close *= 1 + Math.sin(index * 0.21) * 0.003 + (Math.random() - 0.5) * 0.008
      const candle = { time: end - (limit - index - 1) * interval, open, high: Math.max(open, close) * 1.004, low: Math.min(open, close) * 0.996, close, volume: Math.round(700_000 + Math.random() * 4_500_000) }
      return candle
    }).map((candle, index, candles) => index === candles.length - 1 ? { ...candle, close: item.price, high: Math.max(candle.high, item.price) } : candle)
  }

  async subscribe(symbol: string, onCandle: (candle: MarketCandle) => void): Promise<void> {
    if (this.subscriptions.has(symbol)) return
    const item = this.catalog.find((candidate) => candidate.symbol === symbol)
    if (!item) return
    let close = item.price
    const timer = setInterval(() => {
      const open = close
      close = Math.max(0.01, close + (Math.random() - 0.48) * close * 0.0015)
      const candle = { time: Math.floor(Date.now() / 60_000) * 60, open, high: Math.max(open, close), low: Math.min(open, close), close, volume: Math.round(15_000 + Math.random() * 80_000) }
      item.price = close
      item.volume += candle.volume
      onCandle(candle)
    }, 2500)
    this.subscriptions.set(symbol, timer)
  }

  async unsubscribe(symbol: string): Promise<void> {
    const timer = this.subscriptions.get(symbol)
    if (timer) clearInterval(timer)
    this.subscriptions.delete(symbol)
  }
}