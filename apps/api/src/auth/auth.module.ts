import { Module } from '@nestjs/common'
import { JwtModule } from '@nestjs/jwt'
import { TypeOrmModule } from '@nestjs/typeorm'
import { PaperAccountEntity, UserEntity } from '../database/entities.js'
import { AuthController } from './auth.controller.js'
import { AuthService } from './auth.service.js'
import { JwtAuthGuard } from './jwt-auth.guard.js'

@Module({
  imports: [TypeOrmModule.forFeature([UserEntity, PaperAccountEntity]), JwtModule.register({})],
  controllers: [AuthController],
  providers: [AuthService, JwtAuthGuard],
  exports: [AuthService, JwtModule, JwtAuthGuard],
})
export class AuthModule {}