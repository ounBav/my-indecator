import { Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { ChartLayoutEntity, DrawingEntity, SymbolEntity } from '../database/entities.js'

@Injectable()
export class ChartsService {
  constructor(
    @InjectRepository(DrawingEntity) private readonly drawings: Repository<DrawingEntity>,
    @InjectRepository(ChartLayoutEntity) private readonly layouts: Repository<ChartLayoutEntity>,
    @InjectRepository(SymbolEntity) private readonly symbols: Repository<SymbolEntity>,
  ) {}

  async listDrawings(userId: string, ticker: string) {
    const symbol = await this.symbols.findOneBy({ symbol: ticker.trim().toUpperCase() })
    if (!symbol) throw new NotFoundException('Symbol not found')
    return this.drawings.find({ where: { userId, symbolId: symbol.id }, order: { createdAt: 'ASC' } })
  }

  async saveDrawing(userId: string, input: { symbol: string; kind: string; geometry: Record<string, unknown> }) {
    const symbol = await this.symbols.findOneBy({ symbol: input.symbol.trim().toUpperCase() })
    if (!symbol) throw new NotFoundException('Symbol not found')
    return this.drawings.save(this.drawings.create({ userId, symbolId: symbol.id, kind: input.kind, geometry: input.geometry }))
  }

  async updateDrawing(userId: string, id: string, input: { kind?: string; geometry?: Record<string, unknown> }) {
    const drawing = await this.drawings.findOneBy({ id, userId })
    if (!drawing) throw new NotFoundException('Drawing not found')
    if (input.kind) drawing.kind = input.kind
    if (input.geometry) drawing.geometry = input.geometry
    return this.drawings.save(drawing)
  }

  async removeDrawing(userId: string, id: string) {
    const drawing = await this.drawings.findOneBy({ id, userId })
    if (!drawing) throw new NotFoundException('Drawing not found')
    await this.drawings.remove(drawing)
    return { success: true as const }
  }

  async listLayouts(userId: string, ticker: string) {
    const symbol = await this.symbols.findOneBy({ symbol: ticker.trim().toUpperCase() })
    if (!symbol) throw new NotFoundException('Symbol not found')
    return this.layouts.find({ where: { userId, symbolId: symbol.id }, order: { updatedAt: 'DESC' } })
  }

  async saveLayout(userId: string, input: { symbol: string; name: string; settings: Record<string, unknown> }) {
    const symbol = await this.symbols.findOneBy({ symbol: input.symbol.trim().toUpperCase() })
    if (!symbol) throw new NotFoundException('Symbol not found')
    const layout = await this.layouts.findOne({ where: { userId, symbolId: symbol.id, name: input.name.trim() } })
    if (layout) { layout.settings = input.settings; return this.layouts.save(layout) }
    return this.layouts.save(this.layouts.create({ userId, symbolId: symbol.id, name: input.name.trim(), settings: input.settings }))
  }
}