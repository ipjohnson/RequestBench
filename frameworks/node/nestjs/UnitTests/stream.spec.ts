import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';

import { asText, expected, expressApp } from './app.js';

let app: NestExpressApplication;
beforeAll(async () => (app = await expressApp()));
afterAll(() => app.close());

// rb:test stream.ndjson
test('stream.ndjson: each row of items.medium is a line, with no length', async () => {
  const response = await asText(request(app.getHttpServer()).get('/stream/items'));

  expect(response.status).toBe(200);
  expect(response.headers['content-type']).toBe('application/x-ndjson');
  expect(response.headers['content-length']).toBeUndefined();
  expect((response.body as string).trim().split('\n').map((line) => JSON.parse(line))).toEqual(expected.json('items.medium.json')['items']);
});
