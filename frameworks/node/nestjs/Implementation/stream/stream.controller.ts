import { Readable } from 'node:stream';

import { Controller, Get, Inject, StreamableFile } from '@nestjs/common';

import { PAYLOADS, type Payloads } from '../payloads.js';

/**
 * stream: items.medium's rows written one per line, each as it is produced. StreamableFile, Nest's
 * streamed answer, pipes the lines to the response with no length, so it goes out chunked.
 */
@Controller('stream')
export class StreamController {
  constructor(@Inject(PAYLOADS) private readonly payloads: Payloads) {}

  // rb:handler stream.ndjson
  @Get('items')
  lines(): StreamableFile {
    const rows = this.payloads.medium.items;
    return new StreamableFile(Readable.from(rows.map((row) => `${JSON.stringify(row)}\n`)), { type: 'application/x-ndjson' });
  }
}
