import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { InjectQueue } from '@nestjs/bullmq'
import { InjectRepository } from '@nestjs/typeorm'
import type { Queue } from 'bullmq'
import { DataSource, Repository } from 'typeorm'
import { AlertEntity, AlertEventEntity, NotificationEntity, SymbolEntity } from '../database/entities.js'
import { AlertCondition, CreateAlertInput, UpdateAlertInput } from './alerts.dto.js'

@Injectable()
export class AlertsService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(AlertEntity) private readonly alerts: Repository<AlertEntity>,
    @InjectRepository(AlertEventEntity) private readonly events: Repository<AlertEventEntity>,
    @InjectRepository(SymbolEntity) private readonly symbols: Repository<SymbolEntity>,
    @InjectQueue('email-notifications') private readonly emailQueue: Queue,
  ) {}

  async list(userId: string) {
    const alerts = await this.alerts.find({ where: { userId }, order: { createdAt: 'DESC' }, take: 200 })
    return Promise.all(alerts.map(async (alert) => ({ ...alert, symbol: (await this.symbols.findOneByOrFail({ id: alert.symbolId })).symbol })))
  }

  async create(userId: string, input: CreateAlertInput) {
    const symbol = await this.symbols.findOneBy({ symbol: input.symbol.trim().toUpperCase(), active: true })
    if (!symbol) throw new NotFoundException('Symbol not found')
    if (!Object.values(AlertCondition).includes(input.condition)) throw new BadRequestException('Unsupported alert condition')
    return this.alerts.save(this.alerts.create({ userId, symbolId: symbol.id, condition: input.condition, threshold: String(input.threshold), active: true, lastTriggeredAt: null }))
  }

  async update(userId: string, id: string, input: UpdateAlertInput) {
    const alert = await this.alerts.findOneBy({ id, userId })
    if (!alert) throw new NotFoundException('Alert not found')
    if (input.condition) alert.condition = input.condition
    if (input.threshold !== undefined) alert.threshold = String(input.threshold)
    if (input.active !== undefined) alert.active = input.active
    return this.alerts.save(alert)
  }

  async remove(userId: string, id: string) {
    const alert = await this.alerts.findOneBy({ id, userId })
    if (!alert) throw new NotFoundException('Alert not found')
    await this.alerts.remove(alert)
    return { success: true as const }
  }

  async history(userId: string) {
    const events = await this.events.find({ where: { userId }, order: { triggeredAt: 'DESC' }, take: 100 })
    return Promise.all(events.map(async (event) => {
      const alert = await this.alerts.findOneBy({ id: event.alertId })
      const symbol = alert ? await this.symbols.findOneBy({ id: alert.symbolId }) : null
      return { ...event, symbol: symbol?.symbol ?? null }
    }))
  }

  async trigger(alertId: string, symbol: string, condition: string, threshold: string, observedPrice: number) {
    await this.dataSource.transaction(async (manager) => {
      const locked = await manager.findOne(AlertEntity, { where: { id: alertId, active: true }, lock: { mode: 'pessimistic_write' } })
      if (!locked) return
      const now = new Date()
      if (locked.lastTriggeredAt && now.getTime() - locked.lastTriggeredAt.getTime() < 60_000) return
      locked.lastTriggeredAt = now
      await manager.save(locked)
      await manager.save(AlertEventEntity, manager.create(AlertEventEntity, { alertId: locked.id, userId: locked.userId, observedPrice: String(observedPrice), triggeredAt: now }))
      await manager.save(NotificationEntity, manager.create(NotificationEntity, { userId: locked.userId, kind: 'PRICE_ALERT', title: `${symbol} alert triggered`, payload: { symbol, condition, threshold, observedPrice }, readAt: null }))
      if (process.env.SMTP_HOST && process.env.ALERT_EMAIL_FROM) {
        await this.emailQueue.add('alert', { userId: locked.userId, symbol, condition, threshold, observedPrice }, { attempts: 5, backoff: { type: 'exponential', delay: 1000 }, removeOnComplete: 1000, removeOnFail: 5000 })
      }
    })
  }
}