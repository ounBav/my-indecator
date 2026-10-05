import { Args, Int, Query, Resolver } from '@nestjs/graphql'
import { MarketService } from './market.service.js'
import { CandleModel, MarketSymbolModel } from './market.models.js'

@Resolver()
export class MarketResolver {
  constructor(private readonly markets: MarketService) {}

  @Query(() => [MarketSymbolModel]) symbols(@Args('search', { type: () => String, nullable: true }) search?: string) {
    return this.markets.getSymbols(search)
  }

  @Query(() => MarketSymbolModel, { nullable: true }) symbol(@Args('ticker') ticker: string) {
    return this.markets.getSymbol(ticker)
  }

  @Query(() => [CandleModel]) candles(
    @Args('ticker') ticker: string,
    @Args('timeframe', { defaultValue: '1D' }) timeframe: string,
    @Args('limit', { type: () => Int, defaultValue: 500 }) limit: number,
  ) {
    return this.markets.getHistoricalCandles(ticker, timeframe, limit)
  }
}