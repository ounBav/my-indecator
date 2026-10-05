import { Controller, DefaultValuePipe, Get, Param, ParseIntPipe, Query } from '@nestjs/common'
import { MarketService } from './market.service.js'

@Controller('api/markets')
export class MarketController {
  constructor(private readonly markets: MarketService) {}

  @Get('symbols') symbols(@Query('q') query?: string) { return this.markets.getSymbols(query) }
  @Get('symbols/:symbol') symbol(@Param('symbol') symbol: string) { return this.markets.getSymbol(symbol) }
  @Get('symbols/:symbol/candles') candles(
    @Param('symbol') symbol: string,
    @Query('timeframe') timeframe = '1D',
    @Query('limit', new DefaultValuePipe(500), ParseIntPipe) limit: number,
  ) { return this.markets.getHistoricalCandles(symbol, timeframe, limit) }
}