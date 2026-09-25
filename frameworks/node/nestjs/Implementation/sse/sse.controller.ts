import { Controller, Inject, type MessageEvent, Sse } from '@nestjs/common';
import { from, map, type Observable } from 'rxjs';

import { PAYLOADS, type Payloads } from '../payloads.js';

/** sse: items.medium's rows as server-sent events, through Nest's @Sse(). Each row is the data of one event, which Nest serialises to JSON. */
@Controller('sse')
export class SseController {
  constructor(@Inject(PAYLOADS) private readonly payloads: Payloads) {}

  // rb:handler sse.medium
  @Sse('medium')
  medium(): Observable<MessageEvent> {
    return from(this.payloads.medium.items).pipe(map((row) => ({ data: row })));
  }
}
