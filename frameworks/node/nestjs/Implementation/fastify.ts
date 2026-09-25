import { constants } from 'node:zlib';
import { createRequire } from 'node:module';
import { join } from 'node:path';

import fastifyCompress from '@fastify/compress';
import fastifyEtag from '@fastify/etag';
import fastifyView from '@fastify/view';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { FileInterceptor } from '@nestjs/platform-fastify/multipart';
import Handlebars from 'handlebars';

import { uploads } from './forms/forms.controller.js';
import type { Payloads } from './payloads.js';
import type { Platform } from './platform.js';

const require = createRequire(import.meta.url);

/** Nest's Fastify adapter, on which container-h2 runs the application. */
export const fastify: Platform = {
  adapter: `Fastify ${(require('fastify/package.json') as { version: string }).version}`,
  uploads: uploads(FileInterceptor),
};

/**
 * The application-wide setup the Fastify adapter needs, each part as Nest's guide for it writes it
 * for Fastify. Fastify tags no answer by itself, so @fastify/etag does that, for the whole
 * application, as Express does by default on the other hosts.
 */
export async function configureFastify(app: NestFastifyApplication, payloads: Payloads): Promise<void> {
  const cors = payloads.settings.cors;
  // rb:wiring compressed.*
  // gzip and deflate at zlib's fastest level. The plugin's threshold is 1 kB.
  await app.register(fastifyCompress, { encodings: ['gzip', 'deflate'], zlibOptions: { level: constants.Z_BEST_SPEED } });
  // rb:wiring etag.*
  await app.register(fastifyEtag);
  // rb:wiring cors.*
  // The origin as a list of one. Given a string, @fastify/cors writes it on every answer, whichever
  // origin asked. Given a list, it checks the request's origin.
  app.enableCors({ origin: [cors.origin], methods: [cors.method], allowedHeaders: [cors.header], maxAge: cors.maxAgeSeconds });
  // rb:wiring template.*
  // The plugin setViewEngine registers, awaited. setViewEngine returns before it registers the plugin,
  // after a dynamic import it does not wait for, so listen can start first and never settle.
  await app.register(fastifyView, { engine: { handlebars: Handlebars }, templates: join(import.meta.dirname, 'views') });
  // rb:end
}
