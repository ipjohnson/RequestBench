import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';

import { expected, expressApp } from './app.js';

let app: NestExpressApplication;
beforeAll(async () => (app = await expressApp()));
afterAll(() => app.close());

// rb:test static.file
test('static.file: the committed file is served byte for byte', async () => {
  const file = expected.bytes('items.large.json');

  const response = await request(app.getHttpServer()).get('/static/items.large.json');

  expect(response.status).toBe(200);
  expect(response.headers['content-type']).toMatch(/^application\/json/);
  expect(response.headers['last-modified']).toBeDefined();
  expect(response.text).toBe(file.toString('utf8'));
});
