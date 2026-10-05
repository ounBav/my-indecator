import { Controller, Get, Param, Patch, Req, UseGuards } from '@nestjs/common'
import { JwtAuthGuard, type AuthenticatedRequest } from '../auth/jwt-auth.guard.js'
import { NotificationsService } from './notifications.service.js'

@UseGuards(JwtAuthGuard)
@Controller('api/notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}
  @Get() list(@Req() request: AuthenticatedRequest) { return this.notifications.list(request.user.id) }
  @Patch(':id/read') markRead(@Req() request: AuthenticatedRequest, @Param('id') id: string) { return this.notifications.markRead(request.user.id, id) }
}