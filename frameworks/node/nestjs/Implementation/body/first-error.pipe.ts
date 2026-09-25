import { type ArgumentMetadata, Injectable, type PipeTransform, type Type, ValidationPipe } from '@nestjs/common';
import { PickType } from '@nestjs/mapped-types';

import { CheckedOrder } from './order.dto.js';

// rb:wiring body.*
/**
 * CheckedOrder, one field at a time, in the order it declares them: PickType makes the DTO of each
 * field with that field's rules.
 */
const ONE_FIELD_AT_A_TIME: readonly Type[] = (['customerId', 'status', 'lines'] as const).map((field) => PickType(CheckedOrder, [field]));

/**
 * ValidationPipe checks every field of a DTO. Its stopAtFirstError option stops at the first rule
 * each field breaks, and still checks every field. So the first-error route runs it over one field's
 * DTO at a time and stops at the first that fails. The answer is the one the full check would have
 * listed first.
 */
@Injectable()
export class FirstErrorPipe implements PipeTransform {
  private readonly validation = new ValidationPipe();

  async transform(value: unknown, metadata: ArgumentMetadata): Promise<unknown> {
    for (const metatype of ONE_FIELD_AT_A_TIME) await this.validation.transform(value, { ...metadata, metatype });
    return value;
  }
}
// rb:end
