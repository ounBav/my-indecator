import type { MigrationInterface, QueryRunner } from 'typeorm'

export class InitialMarketDesk1740000000000 implements MigrationInterface {
  name = 'InitialMarketDesk1740000000000'

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE users (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), email varchar(320) NOT NULL UNIQUE, password_hash varchar(100) NOT NULL, refresh_token_hash varchar(100), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now())`)
    await queryRunner.query(`CREATE TABLE exchanges (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), code varchar(24) NOT NULL UNIQUE, name varchar(120) NOT NULL, timezone varchar(64) NOT NULL DEFAULT 'America/New_York', created_at timestamptz NOT NULL DEFAULT now())`)
    await queryRunner.query(`CREATE TABLE symbols (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), exchange_id uuid NOT NULL REFERENCES exchanges(id), symbol varchar(24) NOT NULL, name varchar(180) NOT NULL, currency varchar(24) NOT NULL DEFAULT 'USD', asset_class varchar(32) NOT NULL DEFAULT 'equity', active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(exchange_id, symbol))`)
    await queryRunner.query(`CREATE INDEX ix_symbols_symbol ON symbols(symbol)`)
    await queryRunner.query(`CREATE TABLE candles (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), symbol_id uuid NOT NULL REFERENCES symbols(id), timeframe varchar(8) NOT NULL, timestamp timestamptz NOT NULL, open numeric(20,8) NOT NULL, high numeric(20,8) NOT NULL, low numeric(20,8) NOT NULL, close numeric(20,8) NOT NULL, volume numeric(24,4) NOT NULL, UNIQUE(symbol_id, timeframe, timestamp))`)
    await queryRunner.query(`CREATE INDEX ix_candles_symbol_timeframe_timestamp ON candles(symbol_id, timeframe, timestamp DESC)`)
    await queryRunner.query(`CREATE TABLE watchlists (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE, name varchar(80) NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(user_id, name))`)
    await queryRunner.query(`CREATE TABLE watchlist_items (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), watchlist_id uuid NOT NULL REFERENCES watchlists(id) ON DELETE CASCADE, symbol_id uuid NOT NULL REFERENCES symbols(id), position integer NOT NULL DEFAULT 0, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(watchlist_id, symbol_id), UNIQUE(watchlist_id, position))`)
    await queryRunner.query(`CREATE TABLE alerts (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE, symbol_id uuid NOT NULL REFERENCES symbols(id), condition varchar(24) NOT NULL, threshold numeric(20,8) NOT NULL, active boolean NOT NULL DEFAULT true, last_triggered_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now())`)
    await queryRunner.query(`CREATE INDEX ix_alerts_user_active ON alerts(user_id, active)`)
    await queryRunner.query(`CREATE TABLE alert_events (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), alert_id uuid NOT NULL REFERENCES alerts(id) ON DELETE CASCADE, user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE, observed_price numeric(20,8) NOT NULL, triggered_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now())`)
    await queryRunner.query(`CREATE INDEX ix_alert_events_user_created ON alert_events(user_id, created_at DESC)`)
    await queryRunner.query(`CREATE TABLE paper_accounts (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE, currency varchar(3) NOT NULL DEFAULT 'USD', cash_balance numeric(20,4) NOT NULL DEFAULT 100000, starting_balance numeric(20,4) NOT NULL DEFAULT 100000, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now())`)
    await queryRunner.query(`CREATE TABLE paper_orders (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), account_id uuid NOT NULL REFERENCES paper_accounts(id) ON DELETE CASCADE, symbol_id uuid NOT NULL REFERENCES symbols(id), side varchar(4) NOT NULL, type varchar(8) NOT NULL, quantity numeric(20,8) NOT NULL, limit_price numeric(20,8), fill_price numeric(20,8), status varchar(16) NOT NULL DEFAULT 'OPEN', executed_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now())`)
    await queryRunner.query(`CREATE INDEX ix_paper_orders_account_created ON paper_orders(account_id, created_at DESC)`)
    await queryRunner.query(`CREATE INDEX ix_paper_orders_open ON paper_orders(account_id, status)`)
    await queryRunner.query(`CREATE TABLE paper_positions (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), account_id uuid NOT NULL REFERENCES paper_accounts(id) ON DELETE CASCADE, symbol_id uuid NOT NULL REFERENCES symbols(id), quantity numeric(20,8) NOT NULL, average_price numeric(20,8) NOT NULL, realized_pnl numeric(20,4) NOT NULL DEFAULT 0, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(account_id, symbol_id))`)
    await queryRunner.query(`CREATE TABLE chart_layouts (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE, symbol_id uuid NOT NULL REFERENCES symbols(id), name varchar(80) NOT NULL, settings jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(user_id, symbol_id, name))`)
    await queryRunner.query(`CREATE TABLE drawings (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE, symbol_id uuid NOT NULL REFERENCES symbols(id), kind varchar(16) NOT NULL, geometry jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now())`)
    await queryRunner.query(`CREATE INDEX ix_drawings_user_symbol ON drawings(user_id, symbol_id)`)
    await queryRunner.query(`CREATE TABLE notifications (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE, kind varchar(32) NOT NULL, title varchar(180) NOT NULL, payload jsonb NOT NULL DEFAULT '{}', read_at timestamptz, created_at timestamptz NOT NULL DEFAULT now())`)
    await queryRunner.query(`CREATE INDEX ix_notifications_user_created ON notifications(user_id, created_at DESC)`)
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    for (const table of ['notifications','drawings','chart_layouts','paper_positions','paper_orders','paper_accounts','alert_events','alerts','watchlist_items','watchlists','candles','symbols','exchanges','users']) {
      await queryRunner.query(`DROP TABLE IF EXISTS ${table} CASCADE`)
    }
  }
}