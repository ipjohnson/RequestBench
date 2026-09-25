import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import request from 'supertest';

import { asText, expected, fastifyApp, run } from './app.js';

// The families whose wiring container-h2 does with Fastify's plugins rather than Express's middleware.
// The controllers are the same on both platforms, and the other specs test them on Express.
let app: NestFastifyApplication;
beforeAll(async () => (app = await fastifyApp()));
afterAll(() => app.close());

const cors = expected.settings().cors;

// rb:test compressed.gzip_large
test('compressed.gzip_large: on Fastify, @fastify/compress gzips a large body when asked', async () => {
  const response = await request(app.getHttpServer()).get('/compressed/large').set('accept-encoding', 'gzip');

  expect(response.headers['content-encoding']).toBe('gzip');
  expect(response.body).toEqual(expected.json('items.large.json'));
});

// rb:test compressed.gzip_small
test('compressed.gzip_small: on Fastify, a body under the plugin\'s 1 kB threshold goes out as it is', async () => {
  const response = await request(app.getHttpServer()).get('/compressed/small').set('accept-encoding', 'gzip');

  expect(response.headers['content-encoding']).toBeUndefined();
  expect(response.body).toEqual(expected.json('items.small.json'));
});

// rb:test etag.small,etag.large
for (const [id, size] of [['etag.small', 'small'], ['etag.large', 'large']] as const) {
  test(`${id}: on Fastify, @fastify/etag tags the answer with a strong tag`, async () => {
    const response = await request(app.getHttpServer()).get(`/etag/${size}`);

    expect(response.headers['etag']).toMatch(/^"/);
    expect(response.body).toEqual(expected.json(`items.${size}.json`));
  });
}

// rb:test etag.match_large
test('etag.match_large: on Fastify, a matching If-None-Match is 304 with no body, after the handler ran', async () => {
  const first = await request(app.getHttpServer()).get('/etag/large');

  const response = await request(app.getHttpServer()).get('/etag/large').set('if-none-match', first.headers['etag']!);

  expect(response.status).toBe(304);
  expect(response.text).toBe('');
  expect(Number(response.headers['x-rb-serial'])).toBeGreaterThan(Number(first.headers['x-rb-serial']));
});

// rb:test cors.preflight,cors.disallowed
test('cors.preflight cors.disallowed: on Fastify, @fastify/cors answers the preflight for the one origin it allows', async () => {
  const preflight = (origin: string) =>
    request(app.getHttpServer()).options('/cors/small').set({ origin, 'access-control-request-method': cors.method, 'access-control-request-headers': cors.header });

  const allowed = await preflight(cors.origin);
  const disallowed = await preflight('https://elsewhere.example.net');

  expect(allowed.status).toBe(204);
  expect(allowed.headers['access-control-allow-origin']).toBe(cors.origin);
  expect(allowed.headers['access-control-allow-headers']).toBe(cors.header);
  expect(allowed.headers['access-control-max-age']).toBe(String(cors.maxAgeSeconds));
  expect(allowed.headers['x-rb-serial']).toBeUndefined();
  expect(disallowed.headers['access-control-allow-origin']).toBeUndefined();
});

// rb:test template.small,template.medium
for (const [id, size] of [['template.small', 'small'], ['template.medium', 'medium']] as const) {
  test(`${id}: on Fastify, @fastify/view renders the payload with the same Handlebars view`, async () => {
    const response = await request(app.getHttpServer()).get(`/template/${size}`);

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toMatch(/^text\/html/);
    expect(expected.normal(response.text)).toBe(expected.page(`items.${size}.json`));
  });
}

// rb:test forms.urlencoded
test('forms.urlencoded: on Fastify, the adapter\'s form parser reads query.many\'s eight values', async () => {
  const response = await request(app.getHttpServer()).post('/forms/urlencoded').type('form').send(Object.fromEntries(Object.entries(run.search).map(([k, v]) => [k, String(v)])));

  expect(response.status).toBe(200);
  expect(response.body).toEqual(expected.withEcho('items.small.json', run.search));
});

// rb:test forms.multipart
test('forms.multipart: on Fastify, the multipart FileInterceptor reads the file to its end', async () => {
  const file = expected.bytes('forms.file.txt');

  const response = await request(app.getHttpServer())
    .post('/forms/multipart')
    .field('tenant', run.tenant)
    .field('requestId', run.requestId)
    .attach('file', file, { filename: 'forms.file.txt', contentType: 'text/plain' });

  expect(response.status).toBe(200);
  expect(response.body).toEqual({ file: { name: 'forms.file.txt', bytes: file.length }, echo: { tenant: run.tenant, requestId: run.requestId } });
});

// rb:test static.file
test('static.file: on Fastify, ServeStaticModule serves the file through @fastify/static', async () => {
  const file = expected.bytes('items.large.json');

  const response = await request(app.getHttpServer()).get('/static/items.large.json');

  expect(response.status).toBe(200);
  expect(response.headers['content-type']).toMatch(/^application\/json/);
  expect(response.headers['last-modified']).toBeDefined();
  expect(response.text).toBe(file.toString('utf8'));
});

// rb:test stream.ndjson
test('stream.ndjson: on Fastify, the StreamableFile goes out a row per line, with no length', async () => {
  const response = await asText(request(app.getHttpServer()).get('/stream/items'));

  expect(response.headers['content-type']).toBe('application/x-ndjson');
  expect(response.headers['content-length']).toBeUndefined();
  expect((response.body as string).trim().split('\n').map((line) => JSON.parse(line))).toEqual(expected.json('items.medium.json')['items']);
});

// rb:test sse.medium
test('sse.medium: on Fastify, each row of items.medium is the data of one event', async () => {
  const response = await asText(request(app.getHttpServer()).get('/sse/medium').set('accept', 'text/event-stream'));

  expect(response.headers['content-type']).toBe('text/event-stream');
  const data = (response.body as string).split('\n').filter((line) => line.startsWith('data: ')).map((line) => JSON.parse(line.slice('data: '.length)));
  expect(data).toEqual(expected.json('items.medium.json')['items']);
});

// rb:test cache.vary_one
test('cache.vary_one: on Fastify, a replay carries the serial it was stored with', async () => {
  const get = (tenant: string) => request(app.getHttpServer()).get('/cache/vary/one').set('x-rb-tenant', tenant);

  const alpha = await get('alpha');
  const beta = await get('beta');
  const replay = await get('alpha');

  expect(replay.headers['x-rb-serial']).toBe(alpha.headers['x-rb-serial']);
  expect(beta.headers['x-rb-serial']).not.toBe(alpha.headers['x-rb-serial']);
});

// rb:test errors.unmatched
test('errors.unmatched: on Fastify, Nest answers a path with no route with the same 404', async () => {
  const response = await request(app.getHttpServer()).get('/errors/unmatched');

  expect(response.status).toBe(404);
  expect(response.body).toEqual({ message: 'Cannot GET /errors/unmatched', error: 'Not Found', statusCode: 404 });
});

// rb:test errors.malformed
test('errors.malformed: on Fastify, Nest answers the JSON parser\'s error with its status and message', async () => {
  const response = await request(app.getHttpServer()).post('/body/validate/small').set('content-type', 'application/json').send('{"customerId": 1, "lines": [');

  expect(response.status).toBe(400);
  expect(response.body).toEqual({ message: "Body is not valid JSON but content-type is set to 'application/json'", statusCode: 400 });
});
