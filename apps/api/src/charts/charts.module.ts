import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { AuthModule } from '../auth/auth.module.js'
import { ChartLayoutEntity, DrawingEntity, SymbolEntity } from '../database/entities.js'
import { ChartsController } from './charts.controller.js'
import { ChartsService } from './charts.service.js'

@Module({
  imports: [TypeOrmModule.forFeature([DrawingEntity, ChartLayoutEntity, SymbolEntity]), AuthModule],
  controllers: [ChartsController],
  providers: [ChartsService],
})
export class ChartsModule {}