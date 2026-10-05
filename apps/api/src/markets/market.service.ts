import { BadRequestException, Inject, Injectable, Logger, NotFoundException, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { In, Repository } from 'typeorm'
import { CandleEntity, ExchangeEntity, SymbolEntity } from '../database/entities.js'
import { RedisService } from '../redis/redis.service.js'
import { isValidCandle, MARKET_DATA_PROVIDER, type MarketCandle, type MarketDataProvider, type MarketSymbol } from './market-data.provider.js'

const supportedTimeframes = new Set(['1m', '5m', '15m', '30m', '1h', '4h', '1D', '1W', '1M'])

@Injectable()
export class MarketService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MarketService.name)

  constructor(
    @Inject(MARKET_DATA_PROVIDER) private readonly provider: MarketDataProvider,
    @InjectRepository(ExchangeEntity) private readonly exchanges: Repository<ExchangeEntity>,
    @InjectRepository(SymbolEntity) private readonly symbols: Repository<SymbolEntity>,
    @InjectRepository(CandleEntity) private readonly candles: Repository<CandleEntity>,
    private readonly redis: RedisService,
  ) {}

  async onModuleInit() {
    const exchange = await this.exchanges.findOneBy({ code: 'NASDAQ' }) ?? await this.exchanges.save(this.exchanges.create({ code: 'NASDAQ', name: 'NASDAQ', timezone: 'America/New_York' }))
    const catalog = await this.provider.getSymbols()
    await this.symbols.upsert(catalog.map((item) => ({ exchangeId: exchange.id, symbol: item.symbol, name: item.name, currency: item.currency, assetClass: 'equity', active: true })), ['exchangeId', 'symbol'])
    await Promise.all(catalog.map((item) => this.provider.subscribe(item.symbol, (candle) => { void this.acceptCandle(item.symbol, candle) })))
  }

  async onModuleDestroy() {
    const catalog = await this.provider.getSymbols()
    await Promise.all(catalog.map((item) => this.provider.unsubscribe(item.symbol)))
  }

  async getSymbols(search?: string): Promise<MarketSymbol[]> {
    const symbols = await this.provider.getSymbols()
    const query = search?.trim().toLowerCase()
    return query ? symbols.filter((item) => `${item.symbol} ${item.name}`.toLowerCase().includes(query)).slice(0, 30) : symbols
  }

  async getSymbol(symbol: string): Promise<MarketSymbol> {
    const item = (await this.provider.getSymbols()).find((candidate) => candidate.symbol === symbol.toUpperCase())
    if (!item) throw new NotFoundException('Symbol not found')
    const cached = await this.redis.get(`market:latest:${item.symbol}`)
    if (!cached) return item
    const price = Number(cached)
    return Number.isFinite(price) && price > 0 ? { ...item, price } : item
  }

  async getLatestPrice(symbol: string): Promise<number> { return (await this.getSymbol(symbol)).price }

  async getHistoricalCandles(symbol: string, timeframe: string, limit: number): Promise<MarketCandle[]> {
    const ticker = symbol.toUpperCase()
    if (!supportedTimeframes.has(timeframe)) throw new BadRequestException('Unsupported timeframe')
    if (!Number.isInteger(limit) || limit < 1 || limit > 1000) throw new BadRequestException('Limit must be between 1 and 1000')
    const cacheKey = `market:candles:v2:${ticker}:${timeframe}:${limit}`
    const cached = await this.redis.get(cacheKey)
    if (cached) {
      try { return JSON.parse(cached) as MarketCandle[] } catch { this.logger.warn(`Ignoring malformed history cache for ${ticker}`) }
    }
    const symbolEntity = await this.symbols.findOneBy({ symbol: ticker })
    const persisted = symbolEntity ? await this.candles.find({ where: { symbolId: symbolEntity.id, timeframe }, order: { timestamp: 'DESC' }, take: limit }) : []
    let result = persisted.reverse()
      .map((candle) => ({ time: Math.floor(candle.timestamp.getTime() / 1000), open: Number(candle.open), high: Number(candle.high), low: Number(candle.low), close: Number(candle.close), volume: Number(candle.volume) }))
      .filter((candle) => isValidCandle(candle) && candle.time <= 4_102_444_800)
    if (result.length < limit) {
      result = await this.provider.getHistoricalCandles(ticker, timeframe, limit)
      if (symbolEntity && result.every(isValidCandle)) {
        await this.candles.upsert(result.map((candle) => ({ symbolId: symbolEntity.id, timeframe, timestamp: new Date(candle.time * 1000), open: String(candle.open), high: String(candle.high), low: String(candle.low), close: String(candle.close), volume: String(candle.volume) })), ['symbolId', 'timeframe', 'timestamp'])
      }
    }
    await this.redis.set(cacheKey, JSON.stringify(result), 30)
    return result
  }

  private async acceptCandle(symbol: string, candle: MarketCandle) {
    if (!isValidCandle(candle)) {
      this.logger.warn(`Rejected malformed provider candle for ${symbol}`)
      return
    }
    const previousPrice = await this.redis.get(`market:latest:${symbol}`)
    if (previousPrice) await this.redis.set(`market:previous:${symbol}`, previousPrice, 15)
    await this.redis.set(`market:latest:${symbol}`, String(candle.close), 15)
    await this.redis.publish(`market:${symbol}`, JSON.stringify({ symbol, ...candle }))
    const symbolEntity = await this.symbols.findOne({ where: { symbol } })
    if (symbolEntity) {
      await this.candles.upsert({ symbolId: symbolEntity.id, timeframe: '1m', timestamp: new Date(candle.time * 1000), open: String(candle.open), high: String(candle.high), low: String(candle.low), close: String(candle.close), volume: String(candle.volume) }, ['symbolId', 'timeframe', 'timestamp'])
    }
  }
}