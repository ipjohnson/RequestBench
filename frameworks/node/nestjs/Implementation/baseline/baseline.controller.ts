import { Controller, Get, Header } from '@nestjs/common';

/** baseline: the dispatch floor, with nothing serialised. */
@Controller()
export class BaselineController {
  // rb:handler baseline.plaintext
  @Get('plaintext')
  @Header('Content-Type', 'text/plain; charset=utf-8')
  plaintext(): string {
    return 'Hello, World!';
  }
}
