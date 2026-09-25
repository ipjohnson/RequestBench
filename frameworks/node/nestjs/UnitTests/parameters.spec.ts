import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';

import { expected, expressApp, run } from './app.js';

let app: NestExpressApplication;
beforeAll(async () => (app = await expressApp()));
afterAll(() => app.close());

// rb:test parameters.static
test('parameters.static: the static route wins over the capture that also matches it', async () => {
  const response = await request(app.getHttpServer()).get('/parameters/static/segment/literal');

  expect(response.body).toEqual(expected.json('items.small.json'));
});

// rb:test parameters.one
test('parameters.one: the capture is echoed as a number', async () => {
  const response = await request(app.getHttpServer()).get(`/parameters/${run.one}/segment/literal`);

  expect(response.body).toEqual(expected.withEcho('items.small.json', { one: run.one }));
});

// rb:test parameters.two
test('parameters.two: both captures are echoed as numbers', async () => {
  const response = await request(app.getHttpServer()).get(`/parameters/${run.one}/with-second/${run.two}`);

  expect(response.body).toEqual(expected.withEcho('items.small.json', { one: run.one, two: run.two }));
});

test('a capture that is no integer is refused by ParseIntPipe', async () => {
  const response = await request(app.getHttpServer()).get('/parameters/four/segment/literal');

  expect(response.status).toBe(400);
  expect(response.body).toEqual({ message: 'Validation failed (numeric string is expected)', error: 'Bad Request', statusCode: 400 });
});
