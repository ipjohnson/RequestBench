import { Type } from 'class-transformer';
import { IsInt, IsString } from 'class-validator';

/**
 * query.many's eight values, which forms.urlencoded posts as a form. ValidationPipe with transform
 * turns the strings the query or the form holds into this class, and @Type converts the numbers.
 */
export class Search {
  @Type(() => Number) @IsInt() page: number;
  @Type(() => Number) @IsInt() size: number;
  @IsString() status: string;
  @IsString() category: string;
  @IsString() sort: string;
  @IsString() q: string;
  @Type(() => Number) @IsInt() minPrice: number;
  @Type(() => Number) @IsInt() maxPrice: number;
}
