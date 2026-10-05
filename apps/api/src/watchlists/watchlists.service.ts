import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { DataSource, Repository } from 'typeorm'
import { SymbolEntity, WatchlistEntity, WatchlistItemEntity } from '../database/entities.js'

@Injectable()
export class WatchlistsService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(WatchlistEntity) private readonly lists: Repository<WatchlistEntity>,
    @InjectRepository(WatchlistItemEntity) private readonly items: Repository<WatchlistItemEntity>,
    @InjectRepository(SymbolEntity) private readonly symbols: Repository<SymbolEntity>,
  ) {}

  async create(userId: string, name: string) {
    const list = await this.lists.save(this.lists.create({ userId, name: name.trim() }))
    return { ...list, items: [] }
  }

  async list(userId: string) {
    const lists = await this.lists.find({ where: { userId }, order: { createdAt: 'ASC' } })
    return Promise.all(lists.map(async (list) => ({ ...list, items: await this.listItems(list.id) })))
  }

  async rename(userId: string, id: string, name: string) {
    const list = await this.getOwnedList(userId, id)
    list.name = name.trim()
    return this.lists.save(list)
  }

  async remove(userId: string, id: string) {
    const list = await this.getOwnedList(userId, id)
    await this.lists.remove(list)
    return { success: true as const }
  }

  async addSymbol(userId: string, id: string, ticker: string) {
    const list = await this.getOwnedList(userId, id)
    const symbol = await this.symbols.findOneBy({ symbol: ticker.trim().toUpperCase(), active: true })
    if (!symbol) throw new NotFoundException('Symbol not found')
    const current = await this.items.find({ where: { watchlistId: list.id }, order: { position: 'ASC' } })
    if (current.some((item) => item.symbolId === symbol.id)) throw new BadRequestException('Symbol is already in this watchlist')
    await this.items.save(this.items.create({ watchlistId: list.id, symbolId: symbol.id, position: current.length }))
    return this.listItems(list.id)
  }

  async removeSymbol(userId: string, id: string, ticker: string) {
    const list = await this.getOwnedList(userId, id)
    const symbol = await this.symbols.findOneBy({ symbol: ticker.toUpperCase() })
    if (!symbol) throw new NotFoundException('Symbol not found')
    const item = await this.items.findOneBy({ watchlistId: list.id, symbolId: symbol.id })
    if (!item) throw new NotFoundException('Symbol is not in this watchlist')
    await this.dataSource.transaction(async (manager) => {
      await manager.delete(WatchlistItemEntity, { id: item.id })
      await manager.query('UPDATE watchlist_items SET position = position + 10000 WHERE watchlist_id = $1', [list.id])
      await manager.query('UPDATE watchlist_items SET position = position - 10001 WHERE watchlist_id = $1 AND id <> $2', [list.id, item.id])
    })
    return this.listItems(list.id)
  }

  async reorder(userId: string, id: string, ticker: string, position: number) {
    const list = await this.getOwnedList(userId, id)
    const symbol = await this.symbols.findOneBy({ symbol: ticker.toUpperCase() })
    if (!symbol) throw new NotFoundException('Symbol not found')
    const ordered = await this.items.find({ where: { watchlistId: list.id }, order: { position: 'ASC' } })
    const index = ordered.findIndex((item) => item.symbolId === symbol.id)
    if (index < 0) throw new NotFoundException('Symbol is not in this watchlist')
    const [item] = ordered.splice(index, 1)
    ordered.splice(Math.min(position, ordered.length), 0, item!)
    await this.dataSource.transaction(async (manager) => {
      await manager.query('UPDATE watchlist_items SET position = position + 10000 WHERE watchlist_id = $1', [list.id])
      for (const [nextPosition, entry] of ordered.entries()) {
        await manager.update(WatchlistItemEntity, { id: entry.id }, { position: nextPosition })
      }
    })
    return this.listItems(list.id)
  }

  private async getOwnedList(userId: string, id: string) {
    const list = await this.lists.findOneBy({ id, userId })
    if (!list) throw new NotFoundException('Watchlist not found')
    return list
  }

  private async listItems(watchlistId: string) {
    const items = await this.items.find({ where: { watchlistId }, order: { position: 'ASC' } })
    return Promise.all(items.map(async (item) => ({ ...item, symbol: await this.symbols.findOneByOrFail({ id: item.symbolId }) })))
  }
}