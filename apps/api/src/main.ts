import { NestFactory } from '@nestjs/core'
import helmet from 'helmet'
import cookieParser from 'cookie-parser'
import { ValidationPipe } from '@nestjs/common'
import { AppModule, ObserveInstrument } from './app.module.js'

async function bootstrap() {
  if (process.env.NODE_ENV === 'production') {
    for (const name of ['DATABASE_URL', 'JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET']) {
      if (!process.env[name]) throw new Error(`${name} is required in production`)
    }
  }
  const app = await NestFactory.create(AppModule, {
    instrument: process.env.OBSERVE_APP_KEY && process.env.OBSERVE_APP_SECRET ? ObserveInstrument : undefined,
  })
  app.use(helmet({ contentSecurityPolicy: process.env.NODE_ENV === 'production' ? undefined : false }))
  app.use(cookieParser())
  app.enableCors({ origin: process.env.WEB_ORIGIN ?? 'http://localhost:5173', credentials: true })
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }))
  app.enableShutdownHooks()
  await app.listen(Number(process.env.PORT ?? 3000), '0.0.0.0')
}
await bootstrap();
