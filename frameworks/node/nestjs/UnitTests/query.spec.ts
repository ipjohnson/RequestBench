import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';

import { expected, expressApp, run } from './app.js';

let app: NestExpressApplication;
beforeAll(async () => (app = await expressApp()));
afterAll(() => app.close());

// rb:test query.one
test('query.one: the page is echoed as a number', async () => {
  const response = await request(app.getHttpServer()).get('/query/one').query({ page: String(run.search.page) });

  expect(response.body).toEqual(expected.withEcho('items.small.json', { page: run.search.page }));
});

// rb:test query.many
test('query.many: eight values are echoed, the numbers as numbers', async () => {
  const response = await request(app.getHttpServer()).get('/query/many').query(Object.fromEntries(Object.entries(run.search).map(([k, v]) => [k, String(v)])));

  expect(response.body).toEqual(expected.withEcho('items.small.json', run.search));
});

test('a value that is no integer is ValidationPipe\'s 400', async () => {
  const response = await request(app.getHttpServer()).get('/query/many').query({ ...run.search, page: 'first' });

  expect(response.status).toBe(400);
  expect(response.body.message).toEqual(['page must be an integer number']);
});
