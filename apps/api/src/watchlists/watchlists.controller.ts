import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common'
import { JwtAuthGuard, type AuthenticatedRequest } from '../auth/jwt-auth.guard.js'
import { AddWatchlistSymbolInput, CreateWatchlistInput, ReorderWatchlistItemInput } from './watchlists.dto.js'
import { WatchlistsService } from './watchlists.service.js'

@UseGuards(JwtAuthGuard)
@Controller('api/watchlists')
export class WatchlistsController {
  constructor(private readonly watchlists: WatchlistsService) {}

  @Get() list(@Req() request: AuthenticatedRequest) { return this.watchlists.list(request.user.id) }
  @Post() create(@Req() request: AuthenticatedRequest, @Body() input: CreateWatchlistInput) { return this.watchlists.create(request.user.id, input.name) }
  @Patch(':id') rename(@Req() request: AuthenticatedRequest, @Param('id') id: string, @Body() input: CreateWatchlistInput) { return this.watchlists.rename(request.user.id, id, input.name) }
  @Delete(':id') remove(@Req() request: AuthenticatedRequest, @Param('id') id: string) { return this.watchlists.remove(request.user.id, id) }
  @Post(':id/symbols') addSymbol(@Req() request: AuthenticatedRequest, @Param('id') id: string, @Body() input: AddWatchlistSymbolInput) { return this.watchlists.addSymbol(request.user.id, id, input.symbol) }
  @Delete(':id/symbols/:symbol') removeSymbol(@Req() request: AuthenticatedRequest, @Param('id') id: string, @Param('symbol') symbol: string) { return this.watchlists.removeSymbol(request.user.id, id, symbol) }
  @Patch(':id/symbols/:symbol') reorder(@Req() request: AuthenticatedRequest, @Param('id') id: string, @Param('symbol') symbol: string, @Body() input: ReorderWatchlistItemInput) { return this.watchlists.reorder(request.user.id, id, symbol, input.position) }
}