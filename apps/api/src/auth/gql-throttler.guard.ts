import { ExecutionContext } from '@nestjs/common'
import { GqlExecutionContext } from '@nestjs/graphql'
import { ThrottlerGuard } from '@nestjs/throttler'

export class GqlThrottlerGuard extends ThrottlerGuard {
  protected getRequestResponse(context: ExecutionContext) {
    if (context.getType<string>() !== 'graphql') return super.getRequestResponse(context)
    const gqlContext = GqlExecutionContext.create(context).getContext<Record<string, any>>()
    return {
      req: gqlContext.req ?? gqlContext.request ?? { ip: 'graphql' },
      res: gqlContext.res ?? gqlContext.response ?? gqlContext.req?.res ?? {},
    }
  }
}
