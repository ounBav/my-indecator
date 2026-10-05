import { Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { NotificationEntity } from '../database/entities.js'

@Injectable()
export class NotificationsService {
  constructor(@InjectRepository(NotificationEntity) private readonly notifications: Repository<NotificationEntity>) {}

  list(userId: string) { return this.notifications.find({ where: { userId }, order: { createdAt: 'DESC' }, take: 100 }) }

  async markRead(userId: string, id: string) {
    const notification = await this.notifications.findOneBy({ id, userId })
    if (!notification) throw new NotFoundException('Notification not found')
    notification.readAt = new Date()
    return this.notifications.save(notification)
  }
}