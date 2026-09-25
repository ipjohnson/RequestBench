import { Body, Controller, Delete, Get, HttpCode, Inject, NotFoundException, Param, ParseIntPipe, Patch, Post, Put, Res, ValidationPipe } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';

import { type Item, PAYLOADS, type Payloads } from '../payloads.js';
import { NewItem, UpdateItem } from './item.dto.js';

/**
 * items: every method on one resource over the rows of items.large. A measured row may not leave
 * the server changed, so the writes store nothing and answer as if they had written. A missing row
 * is Nest's NotFoundException. The platform's router answers HEAD with the GET route.
 */
@Controller('items')
export class ItemsController {
  private readonly created: number;

  constructor(@Inject(PAYLOADS) private readonly payloads: Payloads, private readonly adapterHost: HttpAdapterHost) {
    this.created = payloads.large.count + 1;
  }

  private row(id: number): Item {
    const row = this.payloads.row(id);
    if (row === undefined) throw new NotFoundException();
    return row;
  }

  // rb:handler items.create
  @Post()
  create(@Body(ValidationPipe) item: NewItem, @Res({ passthrough: true }) response: unknown): Item {
    this.adapterHost.httpAdapter.setHeader(response, 'Location', `/items/${this.created}`);
    return { id: this.created, ...item };
  }

  // rb:handler items.read,items.head
  // rb:handler errors.not_found
  @Get(':id')
  read(@Param('id', ParseIntPipe) id: number): Item {
    return this.row(id);
  }

  // rb:handler items.replace
  @Put(':id')
  replace(@Param('id', ParseIntPipe) id: number, @Body(ValidationPipe) item: NewItem): Item {
    return { id, ...item };
  }

  // rb:handler items.update
  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body(ValidationPipe) patch: UpdateItem): Item {
    return { ...this.row(id), ...patch };
  }

  // rb:handler items.delete
  @Delete(':id')
  @HttpCode(204)
  delete(@Param('id', ParseIntPipe) id: number): void {
    this.row(id);
  }
}
