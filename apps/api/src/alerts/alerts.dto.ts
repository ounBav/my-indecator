import { IsBoolean, IsEnum, IsNumber, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator'

export enum AlertCondition { PRICE_GT = 'PRICE_GT', PRICE_LT = 'PRICE_LT', PRICE_GTE = 'PRICE_GTE', PRICE_LTE = 'PRICE_LTE', CROSSES_ABOVE = 'CROSSES_ABOVE', CROSSES_BELOW = 'CROSSES_BELOW', VOLUME_GT = 'VOLUME_GT' }

export class CreateAlertInput {
  @IsString() @MinLength(1) @MaxLength(24) symbol!: string
  @IsEnum(AlertCondition) condition!: AlertCondition
  @IsNumber({ maxDecimalPlaces: 8 }) @Min(0.00000001) @Max(1_000_000_000_000) threshold!: number
}

export class UpdateAlertInput {
  @IsOptional() @IsEnum(AlertCondition) condition?: AlertCondition
  @IsOptional() @IsNumber({ maxDecimalPlaces: 8 }) @Min(0.00000001) @Max(1_000_000_000_000) threshold?: number
  @IsOptional() @IsBoolean() active?: boolean
}