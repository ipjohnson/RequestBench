import { BadRequestException, Controller, Get, Headers, Inject } from '@nestjs/common';

import { echoed, PAYLOADS, type Payload, type Payloads } from '../payloads.js';

/**
 * headers: /headers reads no header, and /headers/bind reads three. Nest applies no pipe to a
 * header, so the handler converts the account itself, and refuses a header that is missing or no
 * integer with Nest's BadRequestException.
 */
@Controller('headers')
export class HeadersController {
  constructor(@Inject(PAYLOADS) private readonly payloads: Payloads) {}

  // rb:handler headers.few,headers.many
  @Get()
  unread(): Payload {
    return this.payloads.small;
  }

  // rb:handler headers.bind_few,headers.bind_many
  @Get('bind')
  bind(@Headers('x-rb-tenant') tenant?: string, @Headers('x-rb-request-id') requestId?: string, @Headers('x-rb-account') account?: string) {
    const number = Number(account);
    if (tenant === undefined || requestId === undefined || account === undefined || !Number.isInteger(number)) {
      throw new BadRequestException('x-rb-tenant, x-rb-request-id and x-rb-account are required, the account as an integer');
    }
    return echoed(this.payloads.small, { tenant, requestId, account: number });
  }
}
