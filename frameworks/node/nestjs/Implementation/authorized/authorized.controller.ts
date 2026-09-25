import { Controller, Get, Inject, UseGuards } from '@nestjs/common';

import { PAYLOADS, type Payload, type Payloads } from '../payloads.js';
import { BearerTokenGuard } from './bearer-token.guard.js';

/** authorized: the guard checks the token before the handler runs. */
@Controller('authorized')
@UseGuards(BearerTokenGuard)
export class AuthorizedController {
  constructor(@Inject(PAYLOADS) private readonly payloads: Payloads) {}

  // rb:handler authorized.allowed,authorized.denied
  @Get('small')
  small(): Payload {
    return this.payloads.small;
  }
}
