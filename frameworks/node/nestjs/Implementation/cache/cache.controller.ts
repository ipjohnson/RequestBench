import { Controller, Get, Inject, Param, UseInterceptors } from '@nestjs/common';

import { PAYLOADS, type Payload, type Payloads } from '../payloads.js';
import { serial } from '../serial.js';
import { type Answer, AnswerInterceptor, VaryCacheInterceptor, VaryOn } from './answer.js';

/**
 * cache: the handler skipped and a stored answer written back. AnswerInterceptor is outermost, so it
 * writes the headers of the answer VaryCacheInterceptor hands it, stored or fresh. The handler writes
 * x-rb-serial, so a replayed answer repeats the serial it was stored with.
 */
@Controller('cache')
// rb:wiring cache.*
@UseInterceptors(AnswerInterceptor, VaryCacheInterceptor)
export class CacheController {
  constructor(@Inject(PAYLOADS) private readonly payloads: Payloads) {}

  private answer(body: Payload, vary?: 'one' | 'many'): Answer {
    const headers: Record<string, string> = { 'x-rb-serial': serial() };
    // The Vary header tells a cache in front of the framework what the answer depends on. The store
    // keys on the route's own list.
    if (vary !== undefined) headers['vary'] = Object.keys(this.payloads.settings.cache.vary[vary]).join(', ');
    return { headers, body };
  }

  // rb:handler cache.small
  @Get('small/:key')
  small(@Param('key') key: string): Answer {
    return this.answer(this.payloads.small);
  }

  // rb:handler cache.medium
  @Get('medium/:key')
  medium(@Param('key') key: string): Answer {
    return this.answer(this.payloads.medium);
  }

  // rb:handler cache.large
  @Get('large/:key')
  large(@Param('key') key: string): Answer {
    return this.answer(this.payloads.large);
  }

  // rb:handler cache.vary_one
  @Get('vary/one/:key')
  @VaryOn('one')
  varyOne(@Param('key') key: string): Answer {
    return this.answer(this.payloads.small, 'one');
  }

  // rb:handler cache.vary_many
  @Get('vary/many/:key')
  @VaryOn('many')
  varyMany(@Param('key') key: string): Answer {
    return this.answer(this.payloads.small, 'many');
  }
}
