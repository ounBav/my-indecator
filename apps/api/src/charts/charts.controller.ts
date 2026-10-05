import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common'
import { JwtAuthGuard, type AuthenticatedRequest } from '../auth/jwt-auth.guard.js'
import { SaveChartLayoutInput, SaveDrawingInput } from './charts.dto.js'
import { ChartsService } from './charts.service.js'

@UseGuards(JwtAuthGuard)
@Controller('api/charts')
export class ChartsController {
  constructor(private readonly charts: ChartsService) {}

  @Get('drawings') drawings(@Req() request: AuthenticatedRequest, @Query('symbol') symbol: string) { return this.charts.listDrawings(request.user.id, symbol) }
  @Post('drawings') saveDrawing(@Req() request: AuthenticatedRequest, @Body() input: SaveDrawingInput) { return this.charts.saveDrawing(request.user.id, input) }
  @Patch('drawings/:id') updateDrawing(@Req() request: AuthenticatedRequest, @Param('id') id: string, @Body() input: Partial<SaveDrawingInput>) { return this.charts.updateDrawing(request.user.id, id, input) }
  @Delete('drawings/:id') removeDrawing(@Req() request: AuthenticatedRequest, @Param('id') id: string) { return this.charts.removeDrawing(request.user.id, id) }
  @Get('layouts') layouts(@Req() request: AuthenticatedRequest, @Query('symbol') symbol: string) { return this.charts.listLayouts(request.user.id, symbol) }
  @Post('layouts') saveLayout(@Req() request: AuthenticatedRequest, @Body() input: SaveChartLayoutInput) { return this.charts.saveLayout(request.user.id, input) }
}