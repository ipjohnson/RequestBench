import { PartialType } from '@nestjs/mapped-types';
import { IsBoolean, IsInt, IsString } from 'class-validator';

/** An item as a client creates or replaces one. */
export class NewItem {
  @IsString() name: string;
  @IsString() category: string;
  @IsInt() priceCents: number;
  @IsBoolean() inStock: boolean;
}

/** An item as a client patches one: any of NewItem's fields, as Nest's CRUD generator derives an update DTO. */
export class UpdateItem extends PartialType(NewItem) {}
