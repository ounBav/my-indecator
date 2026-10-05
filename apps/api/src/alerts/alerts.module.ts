import { Module } from '@nestjs/common'
import { BullModule } from '@nestjs/bullmq'
import { TypeOrmModule } from '@nestjs/typeorm'
import { AuthModule } from '../auth/auth.module.js'
import { AlertEntity, AlertEventEntity, NotificationEntity, SymbolEntity, UserEntity } from '../database/entities.js'
import { AlertsController } from './alerts.controller.js'
import { AlertEngineService } from './alert-engine.service.js'
import { AlertsService } from './alerts.service.js'
import { EmailNotificationProcessor } from './email-notification.processor.js'

@Module({
  imports: [TypeOrmModule.forFeature([AlertEntity, AlertEventEntity, NotificationEntity, SymbolEntity, UserEntity]), BullModule.registerQueue({ name: 'email-notifications' }), AuthModule],
  controllers: [AlertsController],
  providers: [AlertsService, AlertEngineService, EmailNotificationProcessor],
})
export class AlertsModule {}