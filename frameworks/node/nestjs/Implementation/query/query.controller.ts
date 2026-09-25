import { Controller, Get, Inject, ParseIntPipe, Query, ValidationPipe } from '@nestjs/common';

import { echoed, PAYLOADS, type Payloads } from '../payloads.js';
import { Search } from './search.dto.js';

/**
 * query: the query string, one value converted by ParseIntPipe, and eight bound to a DTO by
 * ValidationPipe, which converts each as the DTO declares.
 */
@Controller('query')
export class QueryController {
  constructor(@Inject(PAYLOADS) private readonly payloads: Payloads) {}

  // rb:handler query.one
  @Get('one')
  one(@Query('page', ParseIntPipe) page: number) {
    return echoed(this.payloads.small, { page });
  }

  // rb:handler query.many
  @Get('many')
  many(@Query(new ValidationPipe({ transform: true })) search: Search) {
    return echoed(this.payloads.small, search);
  }
}
