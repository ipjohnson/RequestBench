import { Controller, Get, Inject, Res } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';

import { PAYLOADS, type Payload, type Payloads } from '../payloads.js';
import { serial } from '../serial.js';

/**
 * etag: Nest has no conditional requests of its own. The platform tags every answer it sends and
 * answers a matching If-None-Match with 304: Express does both by default, and on Fastify the
 * @fastify/etag plugin does, registered for the whole application.
 */
@Controller('etag')
export class EtagController {
  constructor(@Inject(PAYLOADS) private readonly payloads: Payloads, private readonly adapterHost: HttpAdapterHost) {}

  // rb:handler etag.small
  @Get('small')
  small(@Res({ passthrough: true }) response: unknown): Payload {
    this.adapterHost.httpAdapter.setHeader(response, 'x-rb-serial', serial());
    return this.payloads.small;
  }

  // rb:handler etag.large,etag.match_large,etag.stale_large
  @Get('large')
  large(@Res({ passthrough: true }) response: unknown): Payload {
    this.adapterHost.httpAdapter.setHeader(response, 'x-rb-serial', serial());
    return this.payloads.large;
  }
}
