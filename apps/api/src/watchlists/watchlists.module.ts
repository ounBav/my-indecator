import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { AuthModule } from '../auth/auth.module.js'
import { SymbolEntity, WatchlistEntity, WatchlistItemEntity } from '../database/entities.js'
import { WatchlistsController } from './watchlists.controller.js'
import { WatchlistsService } from './watchlists.service.js'

@Module({
  imports: [TypeOrmModule.forFeature([WatchlistEntity, WatchlistItemEntity, SymbolEntity]), AuthModule],
  controllers: [WatchlistsController],
  providers: [WatchlistsService],
})
export class WatchlistsModule {}