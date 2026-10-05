import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common'
import { Interval } from '@nestjs/schedule'
import { InjectRepository } from '@nestjs/typeorm'
import { Decimal } from 'decimal.js'
import { DataSource, Repository } from 'typeorm'
import { NotificationEntity, PaperAccountEntity, PaperOrderEntity, PaperPositionEntity, SymbolEntity } from '../database/entities.js'
import { MarketService } from '../markets/market.service.js'
import { CreatePaperOrderInput, OrderSide, OrderType } from './trading.dto.js'

@Injectable()
export class TradingService {
  private readonly logger = new Logger(TradingService.name)

  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(PaperAccountEntity) private readonly accounts: Repository<PaperAccountEntity>,
    @InjectRepository(PaperOrderEntity) private readonly orders: Repository<PaperOrderEntity>,
    @InjectRepository(PaperPositionEntity) private readonly positions: Repository<PaperPositionEntity>,
    @InjectRepository(SymbolEntity) private readonly symbols: Repository<SymbolEntity>,
    private readonly markets: MarketService,
  ) {}

  async accountSummary(userId: string) {
    const account = await this.accounts.findOneBy({ userId })
    if (!account) throw new NotFoundException('Paper account not found')
    const openPositions = await this.positions.find({ where: { accountId: account.id } })
    let marketValue = new Decimal(0)
    let unrealizedPnl = new Decimal(0)
    for (const position of openPositions) {
      const quantity = new Decimal(position.quantity)
      if (quantity.isZero()) continue
      const currentPrice = new Decimal(await this.markets.getLatestPrice((await this.symbols.findOneByOrFail({ id: position.symbolId })).symbol))
      marketValue = marketValue.plus(quantity.mul(currentPrice))
      unrealizedPnl = unrealizedPnl.plus(currentPrice.minus(position.averagePrice).mul(quantity))
    }
    const realizedPnl = openPositions.reduce((total, position) => total.plus(position.realizedPnl), new Decimal(0))
    const cash = new Decimal(account.cashBalance)
    return {
      currency: account.currency,
      cashBalance: cash.toFixed(4),
      equity: cash.plus(marketValue).toFixed(4),
      startingBalance: account.startingBalance,
      realizedPnl: realizedPnl.toFixed(4),
      unrealizedPnl: unrealizedPnl.toFixed(4),
      openPositionCount: openPositions.filter((position) => !new Decimal(position.quantity).isZero()).length,
    }
  }

  async listPositions(userId: string) {
    const account = await this.accounts.findOneBy({ userId })
    if (!account) throw new NotFoundException('Paper account not found')
    const positions = await this.positions.find({ where: { accountId: account.id }, order: { updatedAt: 'DESC' } })
    const result = []
    for (const position of positions) {
      const quantity = new Decimal(position.quantity)
      if (quantity.isZero()) continue
      const symbol = await this.symbols.findOneByOrFail({ id: position.symbolId })
      const price = new Decimal(await this.markets.getLatestPrice(symbol.symbol))
      result.push({ symbol: symbol.symbol, quantity: quantity.toString(), averagePrice: position.averagePrice, lastPrice: price.toString(), marketValue: quantity.mul(price).toFixed(4), unrealizedPnl: price.minus(position.averagePrice).mul(quantity).toFixed(4), realizedPnl: position.realizedPnl })
    }
    return result
  }

  async listOrders(userId: string, status?: string) {
    const account = await this.accounts.findOneBy({ userId })
    if (!account) throw new NotFoundException('Paper account not found')
    const orders = await this.orders.find({ where: { accountId: account.id, ...(status ? { status } : {}) }, order: { createdAt: 'DESC' }, take: 200 })
    return Promise.all(orders.map(async (order) => ({ ...order, symbol: (await this.symbols.findOneByOrFail({ id: order.symbolId })).symbol })))
  }

  async submitOrder(userId: string, input: CreatePaperOrderInput) {
    const ticker = input.symbol.trim().toUpperCase()
    const symbol = await this.symbols.findOneBy({ symbol: ticker, active: true })
    if (!symbol) throw new NotFoundException('Symbol not found')
    if (input.type === OrderType.LIMIT && (!input.limitPrice || !Number.isFinite(input.limitPrice))) throw new BadRequestException('A valid limit price is required')
    const currentPrice = new Decimal(await this.markets.getLatestPrice(ticker))
    const limitPrice = input.limitPrice === undefined ? null : new Decimal(input.limitPrice)
    const isMarket = input.type === OrderType.MARKET
    const limitIsCrossed = limitPrice !== null && (input.side === OrderSide.BUY ? currentPrice.lte(limitPrice) : currentPrice.gte(limitPrice))

    const result = await this.dataSource.transaction(async (manager) => {
      const account = await manager.findOne(PaperAccountEntity, { where: { userId }, lock: { mode: 'pessimistic_write' } })
      if (!account) throw new NotFoundException('Paper account not found')
      if (input.side === OrderSide.SELL && input.type === OrderType.LIMIT) {
        const position = await manager.findOne(PaperPositionEntity, { where: { accountId: account.id, symbolId: symbol.id }, lock: { mode: 'pessimistic_write' } })
        const openSells = await manager.find(PaperOrderEntity, { where: { accountId: account.id, symbolId: symbol.id, side: OrderSide.SELL, status: 'OPEN' } })
        const reserved = openSells.reduce((total, openOrder) => total.plus(openOrder.quantity), new Decimal(0))
        if (!position || new Decimal(position.quantity).minus(reserved).lt(input.quantity)) throw new BadRequestException('Insufficient unreserved paper shares for limit sell')
      }
      const order = manager.create(PaperOrderEntity, {
        accountId: account.id, symbolId: symbol.id, side: input.side, type: input.type,
        quantity: new Decimal(input.quantity).toFixed(8), limitPrice: limitPrice?.toFixed(8) ?? null,
        fillPrice: null, status: 'OPEN', executedAt: null,
      })
      await manager.save(order)
      if (isMarket || limitIsCrossed) await this.fill(manager, account, order, symbol.symbol, currentPrice)
      return order
    })
    return { ...result, symbol: ticker, message: result.status === 'FILLED' ? 'Paper order filled' : 'Limit order accepted' }
  }

  async cancelOrder(userId: string, orderId: string) {
    return this.dataSource.transaction(async (manager) => {
      const account = await manager.findOne(PaperAccountEntity, { where: { userId }, lock: { mode: 'pessimistic_write' } })
      if (!account) throw new NotFoundException('Paper account not found')
      const order = await manager.findOne(PaperOrderEntity, { where: { id: orderId, accountId: account.id }, lock: { mode: 'pessimistic_write' } })
      if (!order) throw new NotFoundException('Order not found')
      if (order.status !== 'OPEN') throw new BadRequestException('Only open orders can be cancelled')
      order.status = 'CANCELLED'
      return manager.save(order)
    })
  }

  @Interval(2500)
  async fillCrossedLimitOrders() {
    const orders = await this.orders.find({ where: { status: 'OPEN', type: OrderType.LIMIT }, order: { createdAt: 'ASC' }, take: 100 })
    for (const order of orders) {
      try {
        const [symbol, price] = await Promise.all([this.symbols.findOneByOrFail({ id: order.symbolId }), this.markets.getLatestPrice((await this.symbols.findOneByOrFail({ id: order.symbolId })).symbol)])
        const current = new Decimal(price)
        const limit = new Decimal(order.limitPrice!)
        const crossed = order.side === OrderSide.BUY ? current.lte(limit) : current.gte(limit)
        if (!crossed) continue
        await this.dataSource.transaction(async (manager) => {
          const currentOrder = await manager.findOne(PaperOrderEntity, { where: { id: order.id }, lock: { mode: 'pessimistic_write' } })
          if (!currentOrder || currentOrder.status !== 'OPEN') return
          const account = await manager.findOne(PaperAccountEntity, { where: { id: currentOrder.accountId }, lock: { mode: 'pessimistic_write' } })
          if (account) await this.fill(manager, account, currentOrder, symbol.symbol, current)
        })
      } catch (error) {
        this.logger.warn(`Could not evaluate limit order ${order.id}: ${String(error)}`)
      }
    }
  }

  private async fill(manager: DataSource['manager'], account: PaperAccountEntity, order: PaperOrderEntity, ticker: string, price: Decimal) {
    const quantity = new Decimal(order.quantity)
    const notional = quantity.mul(price)
    let position = await manager.findOne(PaperPositionEntity, { where: { accountId: account.id, symbolId: order.symbolId }, lock: { mode: 'pessimistic_write' } })
    if (order.side === OrderSide.BUY) {
      const cash = new Decimal(account.cashBalance)
      if (cash.lt(notional)) {
        order.status = 'REJECTED'
        await manager.save(order)
        return
      }
      account.cashBalance = cash.minus(notional).toFixed(4)
      const oldQuantity = new Decimal(position?.quantity ?? 0)
      const totalQuantity = oldQuantity.plus(quantity)
      const averagePrice = oldQuantity.mul(position?.averagePrice ?? 0).plus(notional).div(totalQuantity)
      position = position ?? manager.create(PaperPositionEntity, { accountId: account.id, symbolId: order.symbolId, quantity: '0', averagePrice: '0', realizedPnl: '0' })
      position.quantity = totalQuantity.toFixed(8)
      position.averagePrice = averagePrice.toFixed(8)
      await manager.save(position)
    } else {
      if (!position || new Decimal(position.quantity).lt(quantity)) throw new BadRequestException('Insufficient paper shares to sell')
      const oldQuantity = new Decimal(position.quantity)
      position.quantity = oldQuantity.minus(quantity).toFixed(8)
      position.realizedPnl = new Decimal(position.realizedPnl).plus(price.minus(position.averagePrice).mul(quantity)).toFixed(4)
      account.cashBalance = new Decimal(account.cashBalance).plus(notional).toFixed(4)
      await manager.save(position)
    }
    order.status = 'FILLED'
    order.fillPrice = price.toFixed(8)
    order.executedAt = new Date()
    await manager.save([account, order])
    await manager.save(NotificationEntity, manager.create(NotificationEntity, { userId: account.userId, kind: 'PAPER_ORDER', title: `${order.side} ${ticker} filled`, payload: { orderId: order.id, quantity: quantity.toString(), price: price.toString() }, readAt: null }))
  }
}