import { readFileSync } from 'node:fs';

import { Controller, Get, Header, Inject } from '@nestjs/common';

import { PLATFORM, type Platform } from '../platform.js';

/** The version of the Nest core that was installed, read from its package, which exports no package.json. */
const version = (JSON.parse(readFileSync(new URL('package.json', import.meta.resolve('@nestjs/core')), 'utf8')) as { version: string }).version;

/** /health and /__meta, which the contract asks of every framework outside the corpus. */
@Controller()
export class ContractController {
  constructor(@Inject(PLATFORM) private readonly platform: Platform) {}

  // The payloads are loaded before Nest creates the application, so an application that answers has them.
  @Get('health')
  @Header('Content-Type', 'text/plain; charset=utf-8')
  health(): string {
    return 'ok';
  }

  @Get('__meta')
  meta() {
    return {
      framework: 'NestJS',
      version,
      runtime: `Node.js ${process.versions.node}`,
      adapter: this.platform.adapter,
      serializer: 'JSON.stringify',
    };
  }
}
