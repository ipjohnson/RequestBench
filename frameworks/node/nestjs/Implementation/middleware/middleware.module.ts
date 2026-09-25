import { Controller, Get, Inject, type MiddlewareConsumer, Module, type NestModule } from '@nestjs/common';

import { PAYLOADS, type Payload, type Payloads } from '../payloads.js';

// rb:wiring middleware.*
/** One layer, a functional middleware as Nest's middleware guide writes one: it calls the next and does nothing else. */
export function layer(_request: unknown, _response: unknown, next: () => void): void {
  next();
}
// rb:end

/** middleware: no-op layers in front of the handler, applied to its route alone. */
@Controller('middleware')
export class MiddlewareController {
  constructor(@Inject(PAYLOADS) private readonly payloads: Payloads) {}

  // rb:handler middleware.none
  @Get('none')
  none(): Payload {
    return this.payloads.small;
  }

  // rb:handler middleware.four
  @Get('four')
  four(): Payload {
    return this.payloads.small;
  }

  // rb:handler middleware.sixteen
  @Get('sixteen')
  sixteen(): Payload {
    return this.payloads.small;
  }
}

@Module({ controllers: [MiddlewareController] })
export class MiddlewareModule implements NestModule {
  // rb:wiring middleware.*
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(...Array<typeof layer>(4).fill(layer)).forRoutes('middleware/four');
    consumer.apply(...Array<typeof layer>(16).fill(layer)).forRoutes('middleware/sixteen');
  }
  // rb:end
}
