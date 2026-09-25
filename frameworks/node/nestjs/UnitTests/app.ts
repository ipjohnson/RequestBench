import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import type { Test as Request } from 'supertest';

import { AppModule } from '../Implementation/app.module.js';
import { configureExpress, express } from '../Implementation/express.js';
import { configureFastify, fastify } from '../Implementation/fastify.js';
import { load } from '../Implementation/payloads.js';

/** tests/payloads, found by walking up from this file to the repository. */
function find(): string {
  for (let dir = import.meta.dirname; dir !== dirname(dir); dir = dirname(dir)) {
    const candidate = join(dir, 'tests', 'payloads');
    if (existsSync(join(candidate, 'items.large.json'))) return candidate;
  }
  throw new Error(`no tests/payloads above ${import.meta.dirname}`);
}

/** The payload directory, as rb suite names it in RB_PAYLOADS, or found. */
export const directory = process.env['RB_PAYLOADS'] ?? find();

// The image sets NODE_ENV=production, which decides whether Express keeps its compiled views.
process.env['NODE_ENV'] = 'production';

const payloads = load(directory);

/*
 * Each application is created with NestFactory, as the hosts create it, rather than with Nest's testing
 * module. The testing module creates every provider before it has an HTTP adapter, so
 * ServeStaticModule finds no adapter and chooses the loader that serves nothing, as
 * https://github.com/nestjs/serve-static/issues/240 describes. abortOnError false makes a failure to
 * start throw, where NestFactory would otherwise end the process.
 */

/** The application as container-h1 creates it, on Nest's Express adapter. */
export async function expressApp(): Promise<NestExpressApplication> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule.register(payloads, express), { logger: false, abortOnError: false });
  configureExpress(app, payloads);
  return app.init();
}

/** The application as container-h2 creates it, on Nest's Fastify adapter, over HTTP/1.1, which supertest speaks. */
export async function fastifyApp(): Promise<NestFastifyApplication> {
  const app = await NestFactory.create<NestFastifyApplication>(AppModule.register(payloads, fastify), new FastifyAdapter(), { logger: false, abortOnError: false });
  await configureFastify(app, payloads);
  await app.init();
  await app.getHttpAdapter().getInstance().ready();
  return app;
}

/** The body as text, for a type supertest would otherwise not keep, such as application/x-ndjson. */
export const asText = (request: Request): Request =>
  request.buffer(true).parse((response, done) => {
    let text = '';
    response.setEncoding('utf8');
    response.on('data', (chunk: string) => (text += chunk));
    response.on('end', () => done(null, text));
  });

interface Row {
  readonly id: number;
  readonly name: string;
  readonly category: string;
  readonly priceCents: number;
  readonly inStock: boolean;
}

/** The values a run draws, fixed as orchestrator/test/reference.ts fixes them. */
export const run = {
  one: 4821,
  two: 7390,
  tenant: 'qwertyuiopas',
  requestId: '0123456789abcdef',
  account: 482913,
  search: { page: 417, size: 38, status: 'paid', category: 'garden', sort: 'created', q: 'alpha bravo', minPrice: 1200, maxPrice: 34000 },
};

/** What an answer has to be, read from the committed payloads rather than from the Implementation. */
export const expected = {
  bytes: (file: string): Buffer => readFileSync(join(directory, file)),

  text: (file: string): string => readFileSync(join(directory, file), 'utf8'),

  json: (file: string): Record<string, unknown> => JSON.parse(readFileSync(join(directory, file), 'utf8')),

  settings: () => expected.json('settings.json') as { token: string; wrongToken: string; staleEtag: string; cors: { origin: string; method: string; header: string; maxAgeSeconds: number } },

  /** A payload with an echo object beside its own fields, as a binding handler answers. */
  withEcho: (file: string, echo: Record<string, unknown>): Record<string, unknown> => ({ ...expected.json(file), echo }),

  /** Row `id` of items.large. */
  row: (id: number): Row => (expected.json('items.large.json')['items'] as Row[]).find((r) => r.id === id)!,

  /** The page the template rows render, as tests/payloads/index.ts writes it. */
  page: (file: string): string => {
    const p = expected.json(file) as { size: string; count: number; items: Row[] };
    const rows = p.items
      .map((it) => `<tr><td>${it.id}</td><td>${it.name}</td><td>${it.category}</td><td>${it.priceCents}</td><td>${it.inStock ? 'yes' : 'no'}</td></tr>`)
      .join('');
    return (
      '<!doctype html><html><head><title>items</title></head><body>' +
      `<h1>${p.size}</h1><table><thead><tr><th>id</th><th>name</th><th>category</th><th>price</th><th>stock</th></tr></thead>` +
      `<tbody>${rows}</tbody></table><p>${p.count} rows</p></body></html>`
    );
  },

  /** Whitespace at an element boundary removed and every other run collapsed, as the corpus compares a page. */
  normal: (html: string): string => html.replace(/[ \t\n\r\f\v]+/g, ' ').replace(/>[ ]+/g, '>').replace(/[ ]+</g, '<').trim(),
};
