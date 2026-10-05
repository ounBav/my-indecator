import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { AuthModule } from '../auth/auth.module.js'
import { NotificationEntity, PaperAccountEntity, PaperOrderEntity, PaperPositionEntity, SymbolEntity } from '../database/entities.js'
import { MarketModule } from '../markets/market.module.js'
import { TradingController } from './trading.controller.js'
import { TradingService } from './trading.service.js'

@Module({
  imports: [TypeOrmModule.forFeature([PaperAccountEntity, PaperOrderEntity, PaperPositionEntity, SymbolEntity, NotificationEntity]), AuthModule, MarketModule],
  controllers: [TradingController],
  providers: [TradingService],
  exports: [TradingService],
})
export class TradingModule {}