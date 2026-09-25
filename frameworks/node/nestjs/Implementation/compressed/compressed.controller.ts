import { Controller, Get, Inject, Res } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';

import { PAYLOADS, type Payload, type Payloads } from '../payloads.js';
import { serial } from '../serial.js';

/**
 * compressed: compression is the platform's, installed for the whole application as Nest's
 * compression guide installs it: the compression middleware on Express, and @fastify/compress on
 * Fastify. These routes only answer.
 */
@Controller('compressed')
export class CompressedController {
  constructor(@Inject(PAYLOADS) private readonly payloads: Payloads, private readonly adapterHost: HttpAdapterHost) {}

  // rb:handler compressed.gzip_small,compressed.identity_small
  @Get('small')
  small(@Res({ passthrough: true }) response: unknown): Payload {
    this.adapterHost.httpAdapter.setHeader(response, 'x-rb-serial', serial());
    return this.payloads.small;
  }

  // rb:handler compressed.gzip_large,compressed.identity_large
  @Get('large')
  large(@Res({ passthrough: true }) response: unknown): Payload {
    this.adapterHost.httpAdapter.setHeader(response, 'x-rb-serial', serial());
    return this.payloads.large;
  }
}
