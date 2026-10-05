import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import type { Request } from 'express'
import type { AuthUser } from './auth.dto.js'

export type AuthenticatedRequest = Request & { user: AuthUser }

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>()
    const authorization = request.headers.authorization
    const token = authorization?.startsWith('Bearer ') ? authorization.slice(7) : undefined
    if (!token) throw new UnauthorizedException('Bearer token required')
    try {
      const payload = await this.jwtService.verifyAsync<AuthUser & { sub: string }>(token, {
        secret: process.env.JWT_ACCESS_SECRET ?? 'local-only-access-secret-change-me-before-deploy',
      })
      request.user = { id: payload.sub, email: payload.email }
      return true
    } catch {
      throw new UnauthorizedException('Invalid or expired access token')
    }
  }
}