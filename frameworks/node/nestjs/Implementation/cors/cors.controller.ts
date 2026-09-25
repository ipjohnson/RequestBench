import { Controller, Get, Inject, Res } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';

import { PAYLOADS, type Payload, type Payloads } from '../payloads.js';
import { serial } from '../serial.js';

/**
 * cors: enableCors, which the host calls for the whole application as Nest's CORS guide does,
 * answers a preflight before any handler runs and adds its headers to every answer. The handler
 * writes x-rb-serial, so its absence on a preflight shows the platform's CORS answered alone.
 */
@Controller('cors')
export class CorsController {
  constructor(@Inject(PAYLOADS) private readonly payloads: Payloads, private readonly adapterHost: HttpAdapterHost) {}

  // rb:handler cors.request,cors.vary
  @Get('small')
  small(@Res({ passthrough: true }) response: unknown): Payload {
    this.adapterHost.httpAdapter.setHeader(response, 'x-rb-serial', serial());
    return this.payloads.small;
  }
}
