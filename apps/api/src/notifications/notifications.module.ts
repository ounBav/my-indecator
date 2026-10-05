import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { AuthModule } from '../auth/auth.module.js'
import { NotificationEntity } from '../database/entities.js'
import { NotificationsController } from './notifications.controller.js'
import { NotificationsService } from './notifications.service.js'

@Module({
  imports: [TypeOrmModule.forFeature([NotificationEntity]), AuthModule],
  controllers: [NotificationsController],
  providers: [NotificationsService],
})
export class NotificationsModule {}