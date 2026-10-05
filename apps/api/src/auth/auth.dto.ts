import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator'

export class RegisterInput {
  @IsEmail()
  @MaxLength(320)
  email!: string

  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password!: string
}

export class LoginInput extends RegisterInput {}

export class RefreshInput {
  @IsString()
  @MinLength(32)
  refreshToken!: string
}

export type AuthUser = { id: string; email: string }
export type AuthTokens = { accessToken: string; refreshToken: string; user: AuthUser }