import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';

import { asText, expected, expressApp } from './app.js';

let app: NestExpressApplication;
beforeAll(async () => (app = await expressApp()));
afterAll(() => app.close());

// rb:test sse.medium
test('sse.medium: each row of items.medium is the data of one event, whose id is empty', async () => {
  const response = await asText(request(app.getHttpServer()).get('/sse/medium').set('accept', 'text/event-stream'));
  const lines = (response.body as string).split('\n');
  const rows = expected.json('items.medium.json')['items'] as unknown[];

  expect(response.status).toBe(200);
  expect(response.headers['content-type']).toBe('text/event-stream');
  expect(response.headers['content-length']).toBeUndefined();
  expect(lines.filter((line) => line.startsWith('data: ')).map((line) => JSON.parse(line.slice('data: '.length)))).toEqual(rows);
  expect(lines.filter((line) => line.startsWith('id:'))).toEqual(rows.map(() => 'id: '));
});
