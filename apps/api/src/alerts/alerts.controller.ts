import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common'
import { JwtAuthGuard, type AuthenticatedRequest } from '../auth/jwt-auth.guard.js'
import { AlertsService } from './alerts.service.js'
import { CreateAlertInput, UpdateAlertInput } from './alerts.dto.js'

@UseGuards(JwtAuthGuard)
@Controller('api/alerts')
export class AlertsController {
  constructor(private readonly alerts: AlertsService) {}
  @Get() list(@Req() request: AuthenticatedRequest) { return this.alerts.list(request.user.id) }
  @Get('history') history(@Req() request: AuthenticatedRequest) { return this.alerts.history(request.user.id) }
  @Post() create(@Req() request: AuthenticatedRequest, @Body() input: CreateAlertInput) { return this.alerts.create(request.user.id, input) }
  @Patch(':id') update(@Req() request: AuthenticatedRequest, @Param('id') id: string, @Body() input: UpdateAlertInput) { return this.alerts.update(request.user.id, id, input) }
  @Delete(':id') remove(@Req() request: AuthenticatedRequest, @Param('id') id: string) { return this.alerts.remove(request.user.id, id) }
}