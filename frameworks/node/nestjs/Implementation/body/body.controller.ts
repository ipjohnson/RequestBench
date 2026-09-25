import { Body, Controller, Headers, HttpCode, Post, ValidationPipe } from '@nestjs/common';

import { FirstErrorPipe } from './first-error.pipe.js';
import { CheckedOrder, type Order } from './order.dto.js';

/** What a bind or validate row answers: the order back, with the leaves found in it and the bytes received. */
function bound(order: Order, length: string | undefined) {
  // customerId and status, and a productId and a qty per line.
  return { fields: 2 + 2 * order.lines.length, bytes: Number(length), echo: order };
}

/**
 * body: the order parsed by the platform's JSON body parser on every route, and checked by
 * ValidationPipe against CheckedOrder on the validate routes. A body that is not JSON is refused with
 * 400 before any pipe runs. Nest answers a POST with 201 unless @HttpCode says otherwise, and these
 * create nothing.
 */
@Controller('body')
export class BodyController {
  // rb:handler body.bind_small
  @Post('bind/small')
  @HttpCode(200)
  bindSmall(@Body() order: Order, @Headers('content-length') length?: string) {
    return bound(order, length);
  }

  // rb:handler body.bind_medium
  @Post('bind/medium')
  @HttpCode(200)
  bindMedium(@Body() order: Order, @Headers('content-length') length?: string) {
    return bound(order, length);
  }

  // rb:handler body.validate_small,body.rejected_all,errors.malformed
  @Post('validate/small')
  @HttpCode(200)
  validateSmall(@Body(ValidationPipe) order: CheckedOrder, @Headers('content-length') length?: string) {
    return bound(order, length);
  }

  // rb:handler body.validate_medium
  @Post('validate/medium')
  @HttpCode(200)
  validateMedium(@Body(ValidationPipe) order: CheckedOrder, @Headers('content-length') length?: string) {
    return bound(order, length);
  }

  // rb:handler body.rejected_first
  @Post('validate/first-error')
  @HttpCode(200)
  validateFirstError(@Body(FirstErrorPipe) order: CheckedOrder, @Headers('content-length') length?: string) {
    return bound(order, length);
  }
}
