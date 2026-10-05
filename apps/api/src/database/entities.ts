import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm'

@Entity('users')
@Index('uq_users_email', ['email'], { unique: true })
export class UserEntity {
  @PrimaryGeneratedColumn('uuid') id!: string
  @Column({ type: 'varchar', length: 320 }) email!: string
  @Column({ name: 'password_hash', type: 'varchar', length: 100 }) passwordHash!: string
  @Column({ name: 'refresh_token_hash', type: 'varchar', length: 100, nullable: true }) refreshTokenHash!: string | null
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt!: Date
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' }) updatedAt!: Date
}

@Entity('exchanges')
@Index('uq_exchanges_code', ['code'], { unique: true })
export class ExchangeEntity {
  @PrimaryGeneratedColumn('uuid') id!: string
  @Column({ type: 'varchar', length: 24 }) code!: string
  @Column({ type: 'varchar', length: 120 }) name!: string
  @Column({ type: 'varchar', length: 64, default: 'America/New_York' }) timezone!: string
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt!: Date
}

@Entity('symbols')
@Index('uq_symbols_exchange_symbol', ['exchangeId', 'symbol'], { unique: true })
@Index('ix_symbols_symbol', ['symbol'])
export class SymbolEntity {
  @PrimaryGeneratedColumn('uuid') id!: string
  @Column({ name: 'exchange_id', type: 'uuid' }) exchangeId!: string
  @Column({ type: 'varchar', length: 24 }) symbol!: string
  @Column({ type: 'varchar', length: 180 }) name!: string
  @Column({ type: 'varchar', length: 24, default: 'USD' }) currency!: string
  @Column({ name: 'asset_class', type: 'varchar', length: 32, default: 'equity' }) assetClass!: string
  @Column({ type: 'boolean', default: true }) active!: boolean
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt!: Date
}

@Entity('candles')
@Index('ix_candles_symbol_timeframe_timestamp', ['symbolId', 'timeframe', 'timestamp'])
@Index('uq_candles_symbol_timeframe_timestamp', ['symbolId', 'timeframe', 'timestamp'], { unique: true })
export class CandleEntity {
  @PrimaryGeneratedColumn('uuid') id!: string
  @Column({ name: 'symbol_id', type: 'uuid' }) symbolId!: string
  @Column({ type: 'varchar', length: 8 }) timeframe!: string
  @Column({ type: 'timestamptz' }) timestamp!: Date
  @Column({ type: 'numeric', precision: 20, scale: 8 }) open!: string
  @Column({ type: 'numeric', precision: 20, scale: 8 }) high!: string
  @Column({ type: 'numeric', precision: 20, scale: 8 }) low!: string
  @Column({ type: 'numeric', precision: 20, scale: 8 }) close!: string
  @Column({ type: 'numeric', precision: 24, scale: 4 }) volume!: string
}

@Entity('watchlists')
@Index('uq_watchlists_user_name', ['userId', 'name'], { unique: true })
export class WatchlistEntity {
  @PrimaryGeneratedColumn('uuid') id!: string
  @Column({ name: 'user_id', type: 'uuid' }) userId!: string
  @Column({ type: 'varchar', length: 80 }) name!: string
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt!: Date
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' }) updatedAt!: Date
}

@Entity('watchlist_items')
@Index('uq_watchlist_items_symbol', ['watchlistId', 'symbolId'], { unique: true })
@Index('uq_watchlist_items_position', ['watchlistId', 'position'], { unique: true })
export class WatchlistItemEntity {
  @PrimaryGeneratedColumn('uuid') id!: string
  @Column({ name: 'watchlist_id', type: 'uuid' }) watchlistId!: string
  @Column({ name: 'symbol_id', type: 'uuid' }) symbolId!: string
  @Column({ type: 'integer', default: 0 }) position!: number
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt!: Date
}

@Entity('alerts')
@Index('ix_alerts_user_active', ['userId', 'active'])
export class AlertEntity {
  @PrimaryGeneratedColumn('uuid') id!: string
  @Column({ name: 'user_id', type: 'uuid' }) userId!: string
  @Column({ name: 'symbol_id', type: 'uuid' }) symbolId!: string
  @Column({ type: 'varchar', length: 24 }) condition!: string
  @Column({ type: 'numeric', precision: 20, scale: 8 }) threshold!: string
  @Column({ type: 'boolean', default: true }) active!: boolean
  @Column({ name: 'last_triggered_at', type: 'timestamptz', nullable: true }) lastTriggeredAt!: Date | null
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt!: Date
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' }) updatedAt!: Date
}

@Entity('alert_events')
@Index('ix_alert_events_user_created', ['userId', 'createdAt'])
export class AlertEventEntity {
  @PrimaryGeneratedColumn('uuid') id!: string
  @Column({ name: 'alert_id', type: 'uuid' }) alertId!: string
  @Column({ name: 'user_id', type: 'uuid' }) userId!: string
  @Column({ type: 'numeric', precision: 20, scale: 8 }) observedPrice!: string
  @Column({ type: 'timestamptz' }) triggeredAt!: Date
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt!: Date
}

@Entity('paper_accounts')
@Index('uq_paper_accounts_user', ['userId'], { unique: true })
export class PaperAccountEntity {
  @PrimaryGeneratedColumn('uuid') id!: string
  @Column({ name: 'user_id', type: 'uuid' }) userId!: string
  @Column({ type: 'varchar', length: 3, default: 'USD' }) currency!: string
  @Column({ name: 'cash_balance', type: 'numeric', precision: 20, scale: 4, default: 100000 }) cashBalance!: string
  @Column({ name: 'starting_balance', type: 'numeric', precision: 20, scale: 4, default: 100000 }) startingBalance!: string
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt!: Date
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' }) updatedAt!: Date
}

@Entity('paper_orders')
@Index('ix_paper_orders_account_created', ['accountId', 'createdAt'])
@Index('ix_paper_orders_open', ['accountId', 'status'])
export class PaperOrderEntity {
  @PrimaryGeneratedColumn('uuid') id!: string
  @Column({ name: 'account_id', type: 'uuid' }) accountId!: string
  @Column({ name: 'symbol_id', type: 'uuid' }) symbolId!: string
  @Column({ type: 'varchar', length: 4 }) side!: string
  @Column({ type: 'varchar', length: 8 }) type!: string
  @Column({ type: 'numeric', precision: 20, scale: 8 }) quantity!: string
  @Column({ name: 'limit_price', type: 'numeric', precision: 20, scale: 8, nullable: true }) limitPrice!: string | null
  @Column({ name: 'fill_price', type: 'numeric', precision: 20, scale: 8, nullable: true }) fillPrice!: string | null
  @Column({ type: 'varchar', length: 16, default: 'OPEN' }) status!: string
  @Column({ name: 'executed_at', type: 'timestamptz', nullable: true }) executedAt!: Date | null
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt!: Date
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' }) updatedAt!: Date
}

@Entity('paper_positions')
@Index('uq_paper_positions_account_symbol', ['accountId', 'symbolId'], { unique: true })
export class PaperPositionEntity {
  @PrimaryGeneratedColumn('uuid') id!: string
  @Column({ name: 'account_id', type: 'uuid' }) accountId!: string
  @Column({ name: 'symbol_id', type: 'uuid' }) symbolId!: string
  @Column({ type: 'numeric', precision: 20, scale: 8 }) quantity!: string
  @Column({ name: 'average_price', type: 'numeric', precision: 20, scale: 8 }) averagePrice!: string
  @Column({ name: 'realized_pnl', type: 'numeric', precision: 20, scale: 4, default: 0 }) realizedPnl!: string
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt!: Date
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' }) updatedAt!: Date
}

@Entity('chart_layouts')
@Index('uq_chart_layouts_user_symbol_name', ['userId', 'symbolId', 'name'], { unique: true })
export class ChartLayoutEntity {
  @PrimaryGeneratedColumn('uuid') id!: string
  @Column({ name: 'user_id', type: 'uuid' }) userId!: string
  @Column({ name: 'symbol_id', type: 'uuid' }) symbolId!: string
  @Column({ type: 'varchar', length: 80 }) name!: string
  @Column({ type: 'jsonb', default: {} }) settings!: Record<string, unknown>
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt!: Date
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' }) updatedAt!: Date
}

@Entity('drawings')
@Index('ix_drawings_user_symbol', ['userId', 'symbolId'])
export class DrawingEntity {
  @PrimaryGeneratedColumn('uuid') id!: string
  @Column({ name: 'user_id', type: 'uuid' }) userId!: string
  @Column({ name: 'symbol_id', type: 'uuid' }) symbolId!: string
  @Column({ type: 'varchar', length: 16 }) kind!: string
  @Column({ type: 'jsonb' }) geometry!: Record<string, unknown>
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt!: Date
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' }) updatedAt!: Date
}

@Entity('notifications')
@Index('ix_notifications_user_created', ['userId', 'createdAt'])
export class NotificationEntity {
  @PrimaryGeneratedColumn('uuid') id!: string
  @Column({ name: 'user_id', type: 'uuid' }) userId!: string
  @Column({ type: 'varchar', length: 32 }) kind!: string
  @Column({ type: 'varchar', length: 180 }) title!: string
  @Column({ type: 'jsonb', default: {} }) payload!: Record<string, unknown>
  @Column({ name: 'read_at', type: 'timestamptz', nullable: true }) readAt!: Date | null
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt!: Date
}

export const entities = [
  UserEntity, ExchangeEntity, SymbolEntity, CandleEntity, WatchlistEntity, WatchlistItemEntity,
  AlertEntity, AlertEventEntity, PaperAccountEntity, PaperOrderEntity, PaperPositionEntity,
  ChartLayoutEntity, DrawingEntity, NotificationEntity,
]