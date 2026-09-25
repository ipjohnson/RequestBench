import { constants } from 'node:zlib';
import { createRequire } from 'node:module';
import { join } from 'node:path';

import type { NestExpressApplication } from '@nestjs/platform-express';
import { FileInterceptor } from '@nestjs/platform-express';
import compression from 'compression';

import { uploads } from './forms/forms.controller.js';
import type { Payloads } from './payloads.js';
import type { Platform } from './platform.js';

const require = createRequire(import.meta.url);

/** Nest's Express adapter, on which container-h1 and lambda-emulator run the application. */
export const express: Platform = {
  adapter: `Express ${(require('express/package.json') as { version: string }).version}`,
  uploads: uploads(FileInterceptor),
};

/**
 * The application-wide setup the Express adapter needs, each part as Nest's guide for it writes it
 * for Express. Express itself tags every answer with an ETag and answers a matching If-None-Match
 * with 304, which is on by default.
 */
export function configureExpress(app: NestExpressApplication, payloads: Payloads): void {
  const cors = payloads.settings.cors;
  // rb:wiring compressed.*
  // gzip at zlib's fastest level, which the compression middleware takes as its level. Its threshold
  // stays 1 kB.
  app.use(compression({ level: constants.Z_BEST_SPEED }));
  // rb:wiring cors.*
  // The origin as a list of one. Given a string, the cors middleware writes it on every answer, whichever
  // origin asked. Given a list, it checks the request's origin.
  app.enableCors({ origin: [cors.origin], methods: [cors.method], allowedHeaders: [cors.header], maxAge: cors.maxAgeSeconds });
  // rb:wiring template.*
  app.setBaseViewsDir(join(import.meta.dirname, 'views'));
  app.setViewEngine('hbs');
  // rb:end
}
