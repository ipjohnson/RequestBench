import { Type as Of } from 'class-transformer';
import { ArrayMinSize, IsArray, IsInt, IsNotEmpty, IsString, Min, ValidateNested } from 'class-validator';

/** The body the bind and validate rows send, as the bind routes receive it: parsed, and checked by nothing. */
export interface Order {
  readonly customerId: number;
  readonly status: string;
  readonly lines: readonly { readonly productId: number; readonly qty: number }[];
}

// rb:wiring body.*
export class CheckedLine {
  @IsInt() @Min(1) productId: number;
  @IsInt() @Min(1) qty: number;
}

/**
 * The rules orderRequest states, as class-validator decorators on a DTO. ValidationPipe checks every
 * rule and refuses the body with Nest's 400 and a message for each rule it breaks.
 */
export class CheckedOrder {
  @IsInt() @Min(1) customerId: number;
  @IsString() @IsNotEmpty() status: string;
  @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Of(() => CheckedLine) lines: CheckedLine[];
}
// rb:end
