import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { InjectRepository } from '@nestjs/typeorm'
import { compare, hash } from 'bcryptjs'
import { DataSource, Repository } from 'typeorm'
import { PaperAccountEntity, UserEntity, WatchlistEntity } from '../database/entities.js'
import type { AuthTokens, AuthUser, LoginInput, RegisterInput } from './auth.dto.js'

const accessSecret = process.env.JWT_ACCESS_SECRET ?? 'local-only-access-secret-change-me-before-deploy'
const refreshSecret = process.env.JWT_REFRESH_SECRET ?? 'local-only-refresh-secret-change-me-before-deploy'

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(UserEntity) private readonly users: Repository<UserEntity>,
    private readonly dataSource: DataSource,
    private readonly jwtService: JwtService,
  ) {}

  async register(input: RegisterInput): Promise<AuthTokens> {
    const email = input.email.trim().toLowerCase()
    if (await this.users.exist({ where: { email } })) throw new ConflictException('Email is already registered')
    const passwordHash = await hash(input.password, 12)
    const user = await this.dataSource.transaction(async (manager) => {
      const created = await manager.save(UserEntity, manager.create(UserEntity, { email, passwordHash, refreshTokenHash: null }))
      await manager.save(PaperAccountEntity, manager.create(PaperAccountEntity, { userId: created.id, currency: 'USD', cashBalance: '100000.0000', startingBalance: '100000.0000' }))
      await manager.save(WatchlistEntity, manager.create(WatchlistEntity, { userId: created.id, name: 'Main watchlist' }))
      return created
    })
    return this.issueTokens(user)
  }

  async login(input: LoginInput): Promise<AuthTokens> {
    const user = await this.users.findOne({ where: { email: input.email.trim().toLowerCase() } })
    if (!user || !(await compare(input.password, user.passwordHash))) throw new UnauthorizedException('Invalid email or password')
    return this.issueTokens(user)
  }

  async rotate(refreshToken: string): Promise<AuthTokens> {
    let payload: { sub: string; email: string }
    try {
      payload = await this.jwtService.verifyAsync(refreshToken, { secret: refreshSecret })
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token')
    }
    return this.dataSource.transaction(async (manager) => {
      const user = await manager.findOne(UserEntity, { where: { id: payload.sub }, lock: { mode: 'pessimistic_write' } })
      if (!user?.refreshTokenHash || !(await compare(refreshToken, user.refreshTokenHash))) throw new UnauthorizedException('Refresh token has already been used')
      return this.issueTokens(user, manager)
    })
  }

  async logout(userId: string): Promise<{ success: true }> {
    await this.users.update({ id: userId }, { refreshTokenHash: null })
    return { success: true }
  }

  async current(userId: string): Promise<AuthUser> {
    const user = await this.users.findOne({ where: { id: userId }, select: { id: true, email: true } })
    if (!user) throw new UnauthorizedException('Account is unavailable')
    return { id: user.id, email: user.email }
  }

  private async issueTokens(user: UserEntity, manager = this.dataSource.manager): Promise<AuthTokens> {
    const identity = { sub: user.id, email: user.email }
    const accessToken = await this.jwtService.signAsync(identity, { secret: accessSecret, expiresIn: '15m' })
    const refreshToken = await this.jwtService.signAsync(identity, { secret: refreshSecret, expiresIn: '7d' })
    await manager.update(UserEntity, { id: user.id }, { refreshTokenHash: await hash(refreshToken, 12) })
    return { accessToken, refreshToken, user: { id: user.id, email: user.email } }
  }
}