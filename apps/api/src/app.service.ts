import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHealth() { return { status: 'ok', service: 'market-desk-api', timestamp: new Date().toISOString() } }
}
