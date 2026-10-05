import { Body, Controller, Delete, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common'
import { JwtAuthGuard, type AuthenticatedRequest } from '../auth/jwt-auth.guard.js'
import { CreatePaperOrderInput } from './trading.dto.js'
import { TradingService } from './trading.service.js'

@UseGuards(JwtAuthGuard)
@Controller('api/paper')
export class TradingController {
  constructor(private readonly trading: TradingService) {}

  @Get('account') account(@Req() request: AuthenticatedRequest) { return this.trading.accountSummary(request.user.id) }
  @Get('positions') positions(@Req() request: AuthenticatedRequest) { return this.trading.listPositions(request.user.id) }
  @Get('orders') orders(@Req() request: AuthenticatedRequest, @Query('status') status?: string) { return this.trading.listOrders(request.user.id, status) }
  @Post('orders')
  createOrder(@Req() request: AuthenticatedRequest, @Body() input: CreatePaperOrderInput) { return this.trading.submitOrder(request.user.id, input) }
  @Delete('orders/:id') cancelOrder(@Req() request: AuthenticatedRequest, @Param('id') id: string) { return this.trading.cancelOrder(request.user.id, id) }
}