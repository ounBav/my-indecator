import { Body, Controller, Get, Post, Req, Res, UseGuards } from '@nestjs/common'
import { AuthService } from './auth.service.js'
import { LoginInput, RegisterInput } from './auth.dto.js'
import { JwtAuthGuard, type AuthenticatedRequest } from './jwt-auth.guard.js'
import type { Request, Response } from 'express'

const refreshCookie = {
  httpOnly: true,
  sameSite: 'strict' as const,
  secure: process.env.COOKIE_SECURE === undefined ? process.env.NODE_ENV === 'production' : process.env.COOKIE_SECURE === 'true',
  path: '/api/auth',
  maxAge: 7 * 24 * 60 * 60 * 1000,
}

@Controller('api/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register') async register(@Body() input: RegisterInput, @Res({ passthrough: true }) response: Response) {
    return this.session(await this.authService.register(input), response)
  }
  @Post('login') async login(@Body() input: LoginInput, @Res({ passthrough: true }) response: Response) {
    return this.session(await this.authService.login(input), response)
  }
  @Post('refresh') async refresh(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    return this.session(await this.authService.rotate(request.cookies?.refresh_token), response)
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout') async logout(@Req() request: AuthenticatedRequest, @Res({ passthrough: true }) response: Response) {
    response.clearCookie('refresh_token', refreshCookie)
    return this.authService.logout(request.user.id)
  }

  @UseGuards(JwtAuthGuard)
  @Get('me') current(@Req() request: AuthenticatedRequest) { return this.authService.current(request.user.id) }

  private session(tokens: Awaited<ReturnType<AuthService['register']>>, response: Response) {
    response.cookie('refresh_token', tokens.refreshToken, refreshCookie)
    return { accessToken: tokens.accessToken, user: tokens.user }
  }
}