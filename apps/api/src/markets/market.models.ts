import { Field, Float, Int, ObjectType } from '@nestjs/graphql'

@ObjectType()
export class MarketSymbolModel {
  @Field() symbol!: string
  @Field() name!: string
  @Field() exchange!: string
  @Field() currency!: string
  @Field(() => Float) price!: number
  @Field(() => Float) changePercent!: number
  @Field(() => Float) volume!: number
}

@ObjectType()
export class CandleModel {
  @Field(() => Int) time!: number
  @Field(() => Float) open!: number
  @Field(() => Float) high!: number
  @Field(() => Float) low!: number
  @Field(() => Float) close!: number
  @Field(() => Float) volume!: number
}