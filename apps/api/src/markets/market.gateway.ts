import { Logger, OnModuleDestroy } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { OnGatewayInit, SubscribeMessage, WebSocketGateway, WebSocketServer, WsException } from '@nestjs/websockets'
import type { Server, Socket } from 'socket.io'
import { RedisService } from '../redis/redis.service.js'

@WebSocketGateway({ namespace: '/market', cors: { origin: process.env.WEB_ORIGIN ?? 'http://localhost:5173', credentials: true } })
export class MarketGateway implements OnGatewayInit, OnModuleDestroy {
  @WebSocketServer() server!: Server
  private readonly logger = new Logger(MarketGateway.name)
  private subscriber?: ReturnType<RedisService['duplicate']>

  constructor(private readonly jwt: JwtService, private readonly redis: RedisService) {}

  async afterInit() {
    this.subscriber = this.redis.duplicate()
    this.subscriber.on('pmessage', (_pattern, channel, message) => {
      const symbol = channel.slice('market:'.length)
      try { this.server.to(symbol).emit('market.tick', JSON.parse(message)) }
      catch (error) { this.logger.warn(`Dropped malformed market event: ${String(error)}`) }
    })
    await this.subscriber.psubscribe('market:*').catch((error: unknown) => this.logger.warn(`Market pub/sub unavailable: ${String(error)}`))
  }

  async onModuleDestroy() { await this.subscriber?.quit().catch(() => undefined) }

  async handleConnection(client: Socket) {
    const token = client.handshake.auth?.accessToken as string | undefined
    if (!token) return client.disconnect(true)
    try {
      const user = await this.jwt.verifyAsync<{ sub: string }>(token, { secret: process.env.JWT_ACCESS_SECRET ?? 'local-only-access-secret-change-me-before-deploy' })
      client.data.userId = user.sub
    } catch { client.disconnect(true) }
  }

  @SubscribeMessage('market.subscribe')
  subscribe(client: Socket, data: { symbol?: unknown }) {
    if (typeof data?.symbol !== 'string' || !/^[A-Z0-9.-]{1,24}$/i.test(data.symbol)) throw new WsException('Invalid symbol')
    const symbol = data.symbol.toUpperCase()
    void client.join(symbol)
    return { event: 'market.subscribed', data: { symbol } }
  }

  @SubscribeMessage('market.unsubscribe')
  unsubscribe(client: Socket, data: { symbol?: unknown }) {
    if (typeof data?.symbol !== 'string') throw new WsException('Invalid symbol')
    const symbol = data.symbol.toUpperCase()
    void client.leave(symbol)
    return { event: 'market.unsubscribed', data: { symbol } }
  }
}