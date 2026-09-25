import { Controller, Get, Inject } from '@nestjs/common';

import { PAYLOADS, type Payload, type Payloads } from '../payloads.js';

/**
 * json: a payload the framework already holds, which Nest answers as JSON on every request. Three
 * static routes rather than one with a capture, so the router pays no capture here.
 */
@Controller('json')
export class JsonController {
  constructor(@Inject(PAYLOADS) private readonly payloads: Payloads) {}

  // rb:handler json.small,cors.scoped
  @Get('small')
  small(): Payload {
    return this.payloads.small;
  }

  // rb:handler json.medium
  @Get('medium')
  medium(): Payload {
    return this.payloads.medium;
  }

  // rb:handler json.large
  @Get('large')
  large(): Payload {
    return this.payloads.large;
  }
}
