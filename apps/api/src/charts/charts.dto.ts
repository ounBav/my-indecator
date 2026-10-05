import { IsIn, IsObject, IsString, MaxLength, MinLength } from 'class-validator'

export class SaveDrawingInput {
  @IsString() @MinLength(1) @MaxLength(24) symbol!: string
  @IsIn(['horizontal', 'vertical', 'trend', 'ray', 'rectangle', 'text']) kind!: string
  @IsObject() geometry!: Record<string, unknown>
}

export class SaveChartLayoutInput {
  @IsString() @MinLength(1) @MaxLength(24) symbol!: string
  @IsString() @MinLength(1) @MaxLength(80) name!: string
  @IsObject() settings!: Record<string, unknown>
}