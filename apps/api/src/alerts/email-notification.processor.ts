import { Processor, WorkerHost } from '@nestjs/bullmq'
import { InjectRepository } from '@nestjs/typeorm'
import type { Job } from 'bullmq'
import { createTransport } from 'nodemailer'
import { Repository } from 'typeorm'
import { UserEntity } from '../database/entities.js'

type AlertEmailJob = { userId: string; symbol: string; condition: string; threshold: string; observedPrice: number }

@Processor('email-notifications')
export class EmailNotificationProcessor extends WorkerHost {
  constructor(@InjectRepository(UserEntity) private readonly users: Repository<UserEntity>) { super() }

  async process(job: Job<AlertEmailJob>): Promise<void> {
    const user = await this.users.findOne({ where: { id: job.data.userId }, select: { id: true, email: true } })
    if (!user || !process.env.SMTP_HOST || !process.env.ALERT_EMAIL_FROM) return
    const transport = createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: process.env.SMTP_SECURE === 'true',
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } : undefined,
    })
    await transport.sendMail({
      from: process.env.ALERT_EMAIL_FROM,
      to: user.email,
      subject: `${job.data.symbol} price alert triggered`,
      text: `${job.data.symbol} matched ${job.data.condition} ${job.data.threshold}. Observed value: ${job.data.observedPrice}.`,
    })
  }
}