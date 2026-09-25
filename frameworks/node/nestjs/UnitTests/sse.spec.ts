import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';

import { asText, expected, expressApp } from './app.js';

let app: NestExpressApplication;
beforeAll(async () => (app = await expressApp()));
afterAll(() => app.close());

// rb:test sse.medium
test('sse.medium: each row of items.medium is the data of one event', async () => {
  const response = await asText(request(app.getHttpServer()).get('/sse/medium').set('accept', 'text/event-stream'));

  expect(response.status).toBe(200);
  expect(response.headers['content-type']).toBe('text/event-stream');
  expect(response.headers['content-length']).toBeUndefined();
  const data = (response.body as string).split('\n').filter((line) => line.startsWith('data: ')).map((line) => JSON.parse(line.slice('data: '.length)));
  expect(data).toEqual(expected.json('items.medium.json')['items']);
});
