import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';

import { expected, expressApp, run } from './app.js';

let app: NestExpressApplication;
beforeAll(async () => (app = await expressApp()));
afterAll(() => app.close());

const cors = expected.settings().cors;

const preflight = (url: string, origin: string) =>
  request(app.getHttpServer()).options(url).set({ origin, 'access-control-request-method': cors.method, 'access-control-request-headers': cors.header });

// rb:test cors.preflight
test('cors.preflight: the cors middleware answers the preflight before any handler', async () => {
  const response = await preflight('/cors/small', cors.origin);

  expect(response.status).toBe(204);
  expect(response.headers['access-control-allow-origin']).toBe(cors.origin);
  expect(response.headers['access-control-allow-headers']).toBe(cors.header);
  expect(response.headers['access-control-max-age']).toBe(String(cors.maxAgeSeconds));
  expect(response.headers['x-rb-serial']).toBeUndefined();
});

// rb:test cors.disallowed
test('cors.disallowed: a preflight from another origin is not allowed', async () => {
  const response = await preflight('/cors/small', 'https://elsewhere.example.net');

  expect(response.headers['access-control-allow-origin']).toBeUndefined();
});

// rb:test cors.request,cors.vary
test('cors.request cors.vary: the request reaches the handler and varies on origin', async () => {
  const response = await request(app.getHttpServer()).get('/cors/small').set({ origin: cors.origin, [cors.header]: run.tenant });

  expect(response.body).toEqual(expected.json('items.small.json'));
  expect(response.headers['access-control-allow-origin']).toBe(cors.origin);
  expect(response.headers['vary']).toMatch(/\bOrigin\b/);
  expect(response.headers['x-rb-serial']).toBeDefined();
});

// rb.json skips cors.scoped for this. When Nest can scope its CORS to a route, this fails and the skip can go.
// rb:test cors.scoped
test('cors.scoped: enableCors covers the whole application, so a route outside /cors gets the policy too', async () => {
  const response = await request(app.getHttpServer()).get('/json/small').set('origin', cors.origin);

  expect(response.headers['access-control-allow-origin']).toBe(cors.origin);
});
