import { Controller, Get, Inject, Param, ParseIntPipe } from '@nestjs/common';

import { echoed, PAYLOADS, type Payloads } from '../payloads.js';

/**
 * parameters: path captures, each converted to a number by ParseIntPipe, which refuses one that is
 * not an integer with 400. Express tries routes in the order they are declared, so each route comes
 * before the captures that also match its path: the static route first, and the three captures last.
 */
@Controller('parameters')
export class ParametersController {
  constructor(@Inject(PAYLOADS) private readonly payloads: Payloads) {}

  // rb:handler parameters.static
  @Get('static/segment/literal')
  static() {
    return this.payloads.small;
  }

  // rb:handler parameters.one
  @Get(':one/segment/literal')
  one(@Param('one', ParseIntPipe) one: number) {
    return echoed(this.payloads.small, { one });
  }

  // rb:handler parameters.two
  @Get(':one/with-second/:two')
  two(@Param('one', ParseIntPipe) one: number, @Param('two', ParseIntPipe) two: number) {
    return echoed(this.payloads.small, { one, two });
  }

  // rb:handler parameters.three
  @Get(':one/:two/:three')
  three(@Param('one', ParseIntPipe) one: number, @Param('two', ParseIntPipe) two: number, @Param('three', ParseIntPipe) three: number) {
    return echoed(this.payloads.small, { one, two, three });
  }
}
