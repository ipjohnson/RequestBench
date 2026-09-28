import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';

import { expected, expressApp, run } from './app.js';

let app: NestExpressApplication;
beforeAll(async () => (app = await expressApp()));
afterAll(() => app.close());

const allowedOrigin = 'https://shop.example.com';

const preflight = (url: string, origin: string) =>
  request(app.getHttpServer()).options(url).set({ origin, 'access-control-request-method': 'GET', 'access-control-request-headers': 'x-rb-tenant' });

// rb:test cors.preflight
test('cors.preflight: the cors middleware answers the preflight before any handler', async () => {
  const response = await preflight('/cors/small', allowedOrigin);

  expect(response.status).toBe(204);
  expect(response.headers['access-control-allow-origin']).toBe(allowedOrigin);
  expect(response.headers['access-control-allow-headers']).toBe('x-rb-tenant');
  expect(response.headers['access-control-max-age']).toBe('600');
  expect(response.headers['x-rb-serial']).toBeUndefined();
});

// rb:test cors.disallowed
test('cors.disallowed: a preflight from another origin is not allowed', async () => {
  const response = await preflight('/cors/small', 'https://elsewhere.example.net');

  expect(response.headers['access-control-allow-origin']).toBeUndefined();
});

// rb:test cors.request,cors.vary
test('cors.request cors.vary: the request reaches the handler and varies on origin', async () => {
  const response = await request(app.getHttpServer()).get('/cors/small').set({ origin: allowedOrigin, 'x-rb-tenant': run.tenant });

  expect(response.body).toEqual(expected.json('items.small.json'));
  expect(response.headers['access-control-allow-origin']).toBe(allowedOrigin);
  expect(response.headers['vary']).toMatch(/\bOrigin\b/);
  expect(response.headers['x-rb-serial']).toBeDefined();
});

// rb.json skips cors.scoped for this. When Nest can scope its CORS to a route, this fails and the skip can go.
// rb:test cors.scoped
test('cors.scoped: enableCors covers the whole application, so a route outside /cors gets the policy too', async () => {
  const response = await request(app.getHttpServer()).get('/json/small').set('origin', allowedOrigin);

  expect(response.headers['access-control-allow-origin']).toBe(allowedOrigin);
});
