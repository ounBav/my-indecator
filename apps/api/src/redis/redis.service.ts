import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { Redis } from 'ioredis'

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name)
  readonly client = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
    lazyConnect: true,
    maxRetriesPerRequest: 2,
    retryStrategy: (attempt) => Math.min(attempt * 500, 5000),
  })

  async onModuleInit() {
    try { await this.client.connect() }
    catch (error) { this.logger.warn(`Redis is unavailable; cache and realtime fan-out are degraded: ${String(error)}`) }
  }

  async get(key: string): Promise<string | null> {
    if (this.client.status !== 'ready') return null
    try { return await this.client.get(key) } catch (error) { this.logger.warn(`Redis GET failed: ${String(error)}`); return null }
  }

  async set(key: string, value: string, ttlSeconds: number): Promise<void> {
    if (this.client.status !== 'ready') return
    try { await this.client.set(key, value, 'EX', ttlSeconds) } catch (error) { this.logger.warn(`Redis SET failed: ${String(error)}`) }
  }

  async publish(channel: string, message: string): Promise<void> {
    if (this.client.status !== 'ready') return
    try { await this.client.publish(channel, message) } catch (error) { this.logger.warn(`Redis publish failed: ${String(error)}`) }
  }

  duplicate(): Redis { return this.client.duplicate({ lazyConnect: false }) }

  async onModuleDestroy() { await this.client.quit().catch(() => undefined) }
}