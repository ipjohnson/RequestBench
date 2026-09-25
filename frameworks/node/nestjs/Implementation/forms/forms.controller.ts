import { Body, Controller, HttpCode, Inject, type NestInterceptor, Post, type Type, UploadedFile, UseInterceptors, ValidationPipe } from '@nestjs/common';

import { echoed, PAYLOADS, type Payloads } from '../payloads.js';
import { Search } from '../query/search.dto.js';

/**
 * forms: the same eight values query.many reads, from a urlencoded body the platform parses. Nest
 * answers a POST with 201 unless @HttpCode says otherwise, and these create nothing.
 */
@Controller('forms')
export class FormsController {
  constructor(@Inject(PAYLOADS) private readonly payloads: Payloads) {}

  // rb:handler forms.urlencoded
  @Post('urlencoded')
  @HttpCode(200)
  urlencoded(@Body(new ValidationPipe({ transform: true })) search: Search) {
    return echoed(this.payloads.small, search);
  }
}

/** The fields of an upload both platforms' interceptors give the handler. */
interface Upload {
  readonly originalname: string;
  readonly size: number;
}

/**
 * The controller of /forms/multipart, made with the FileInterceptor of the platform the host runs:
 * Nest's upload interceptors take the same arguments on Express, where Multer parses the upload,
 * and on Fastify, where @fastify/multipart does, and each works on its own platform alone.
 */
export function uploads(FileInterceptor: (field: string) => Type<NestInterceptor>): Type {
  @Controller('forms')
  class UploadsController {
    // rb:handler forms.multipart
    @Post('multipart')
    @HttpCode(200)
    @UseInterceptors(FileInterceptor('file'))
    multipart(@UploadedFile() file: Upload, @Body() fields: { tenant: string; requestId: string }) {
      return { file: { name: file.originalname, bytes: file.size }, echo: { tenant: fields.tenant, requestId: fields.requestId } };
    }
  }
  return UploadsController;
}
