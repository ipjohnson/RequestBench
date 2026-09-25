import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';

import { expressApp } from './app.js';

let app: NestExpressApplication;
beforeAll(async () => (app = await expressApp()));
afterAll(() => app.close());

// rb:test baseline.plaintext
test('baseline.plaintext: the string goes out as text', async () => {
  const response = await request(app.getHttpServer()).get('/plaintext');

  expect(response.status).toBe(200);
  expect(response.text).toBe('Hello, World!');
  expect(response.headers['content-type']).toBe('text/plain; charset=utf-8');
});
