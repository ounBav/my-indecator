import { Module } from '@nestjs/common'
import { APP_GUARD } from '@nestjs/core'
import { ApolloDriver, type ApolloDriverConfig } from '@nestjs/apollo'
import { BullModule } from '@nestjs/bullmq'
import { ConfigModule } from '@nestjs/config'
import { GraphQLModule } from '@nestjs/graphql'
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler'
import { ScheduleModule } from '@nestjs/schedule'
import { TypeOrmModule } from '@nestjs/typeorm'
import { createObserveModule } from '@nestjs/observe';
import { AppController } from './app.controller.js'
import { AppService } from './app.service.js'
import { AuthModule } from './auth/auth.module.js'
import { GqlThrottlerGuard } from './auth/gql-throttler.guard.js'
import { AlertsModule } from './alerts/alerts.module.js'
import { ChartsModule } from './charts/charts.module.js'
import { entities } from './database/entities.js'
import { MarketModule } from './markets/market.module.js'
import { NotificationsModule } from './notifications/notifications.module.js'
import { RedisModule } from './redis/redis.module.js'
import { TradingModule } from './trading/trading.module.js'
import { WatchlistsModule } from './watchlists/watchlists.module.js'

export const { ObserveModule, ObserveInstrument } = createObserveModule();
const observeModule = process.env.OBSERVE_APP_KEY && process.env.OBSERVE_APP_SECRET
  ? ObserveModule.forRoot({ appKey: process.env.OBSERVE_APP_KEY, appSecret: process.env.OBSERVE_APP_SECRET, serviceId: 'market-desk-api' })
  : undefined

const dbConnectionConfig = process.env.DATABASE_URL
  ? {
      type: (process.env.DB_CONNECTION ?? 'postgres') as 'postgres',
      url: process.env.DATABASE_URL,
    }
  : {
      type: (process.env.DB_CONNECTION ?? 'postgres') as 'postgres',
      host: process.env.DB_HOST ?? 'localhost',
      port: Number(process.env.DB_PORT ?? 5432),
      username: process.env.DB_USERNAME ?? 'postgres',
      password: process.env.DB_PASSWORD ?? 'pass123',
      database: process.env.DB_SCHEMA ?? 'mydb',
      schema: process.env.DB_SCHEMA ?? 'public',
    }

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRoot({
      ...dbConnectionConfig,
      entities,
      migrations: [process.env.NODE_ENV === 'production' ? 'dist/database/migrations/*.js' : 'src/database/migrations/*.ts'],
      synchronize: process.env.DB_SYNC === 'true',
      logging: process.env.DB_LOGGING === 'true',
      migrationsRun: process.env.DB_MIGRATIONS_RUN === 'true',
      retryAttempts: 8,
      retryDelay: 1500,
    }),
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      autoSchemaFile: true,
      sortSchema: true,
      playground: process.env.NODE_ENV !== 'production',
      introspection: process.env.NODE_ENV !== 'production',
      subscriptions: { 'graphql-ws': {} },
    }),
    BullModule.forRoot({ connection: { host: process.env.REDIS_HOST ?? 'localhost', port: Number(process.env.REDIS_PORT ?? 6379), password: process.env.REDIS_PASSWORD || undefined } }),
    BullModule.registerQueue({ name: 'alert-processing' }, { name: 'email-notifications' }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    ScheduleModule.forRoot(),
    RedisModule,
    AuthModule,
    MarketModule,
    AlertsModule,
    TradingModule,
    WatchlistsModule,
    ChartsModule,
    NotificationsModule,
    ...(observeModule ? [observeModule] : []),
  ],
  controllers: [AppController],
  providers: [AppService, { provide: APP_GUARD, useClass: GqlThrottlerGuard }],
})
export class AppModule {}
