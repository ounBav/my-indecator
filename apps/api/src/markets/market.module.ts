import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { AuthModule } from '../auth/auth.module.js'
import { CandleEntity, ExchangeEntity, SymbolEntity } from '../database/entities.js'
import { DemoMarketDataProvider } from './demo-market-data.provider.js'
import { MARKET_DATA_PROVIDER } from './market-data.provider.js'
import { MarketController } from './market.controller.js'
import { MarketGateway } from './market.gateway.js'
import { MarketResolver } from './market.resolver.js'
import { MarketService } from './market.service.js'

@Module({
  imports: [TypeOrmModule.forFeature([ExchangeEntity, SymbolEntity, CandleEntity]), AuthModule],
  controllers: [MarketController],
  providers: [DemoMarketDataProvider, { provide: MARKET_DATA_PROVIDER, useExisting: DemoMarketDataProvider }, MarketService, MarketResolver, MarketGateway],
  exports: [MarketService, MARKET_DATA_PROVIDER],
})
export class MarketModule {}