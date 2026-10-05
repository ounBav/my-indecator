import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import type { Redis } from 'ioredis'
import { Repository } from 'typeorm'
import { AlertEntity, SymbolEntity } from '../database/entities.js'
import { RedisService } from '../redis/redis.service.js'
import { AlertCondition } from './alerts.dto.js'
import { evaluateAlert } from './alert-evaluator.js'
import { AlertsService } from './alerts.service.js'

@Injectable()
export class AlertEngineService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AlertEngineService.name)
  private subscriber?: Redis

  constructor(
    private readonly redis: RedisService,
    private readonly alerts: AlertsService,
    @InjectRepository(SymbolEntity) private readonly symbols: Repository<SymbolEntity>,
    @InjectRepository(AlertEntity) private readonly alertRecords: Repository<AlertEntity>,
  ) {}

  async onModuleInit() {
    this.subscriber = this.redis.duplicate()
    this.subscriber.on('pmessage', (_pattern, channel, message) => { void this.process(channel, message) })
    await this.subscriber.psubscribe('market:*').catch((error: unknown) => this.logger.warn(`Alert feed unavailable: ${String(error)}`))
  }

  async onModuleDestroy() { await this.subscriber?.quit().catch(() => undefined) }

  private async process(channel: string, message: string) {
    try {
      const event = JSON.parse(message) as { symbol: string; close: number; volume: number }
      if (!event.symbol || !Number.isFinite(event.close) || !Number.isFinite(event.volume)) return
      const symbol = await this.symbols.findOneBy({ symbol: event.symbol })
      if (!symbol) return
      const previousPrice = Number(await this.redis.get(`market:previous:${event.symbol}`))
      const active = await this.alertRecords.find({ where: { symbolId: symbol.id, active: true } })
      for (const alert of active) {
        const condition = alert.condition as AlertCondition
        const current = condition === AlertCondition.VOLUME_GT ? event.volume : event.close
        if (evaluateAlert(condition, Number(alert.threshold), current, Number.isFinite(previousPrice) ? previousPrice : undefined)) {
          await this.alerts.trigger(alert.id, event.symbol, alert.condition, alert.threshold, current)
        }
      }
    } catch (error) { this.logger.warn(`Alert event evaluation failed: ${String(error)}`) }
  }
}