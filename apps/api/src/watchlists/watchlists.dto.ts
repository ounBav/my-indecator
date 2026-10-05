import { IsInt, IsString, Max, MaxLength, Min, MinLength } from 'class-validator'

export class CreateWatchlistInput {
  @IsString() @MinLength(1) @MaxLength(80) name!: string
}

export class AddWatchlistSymbolInput {
  @IsString() @MinLength(1) @MaxLength(24) symbol!: string
}

export class ReorderWatchlistItemInput {
  @IsInt() @Min(0) @Max(500) position!: number
}