import { IsEnum, IsNumber, IsOptional, IsString, Max, Min, MaxLength } from 'class-validator'

export enum OrderSide { BUY = 'BUY', SELL = 'SELL' }
export enum OrderType { MARKET = 'MARKET', LIMIT = 'LIMIT' }

export class CreatePaperOrderInput {
  @IsString()
  @MaxLength(24)
  symbol!: string

  @IsEnum(OrderSide)
  side!: OrderSide

  @IsEnum(OrderType)
  type!: OrderType

  @IsNumber({ maxDecimalPlaces: 8 })
  @Min(0.00000001)
  @Max(1_000_000)
  quantity!: number

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 8 })
  @Min(0.00000001)
  limitPrice?: number
}