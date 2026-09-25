import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';

import { expected, expressApp } from './app.js';

let app: NestExpressApplication;
beforeAll(async () => (app = await expressApp()));
afterAll(() => app.close());

const settings = expected.settings();

// rb:test authorized.allowed
test('authorized.allowed: the accepted token reaches the handler', async () => {
  const response = await request(app.getHttpServer()).get('/authorized/small').set('authorization', `Bearer ${settings.token}`);

  expect(response.status).toBe(200);
  expect(response.body).toEqual(expected.json('items.small.json'));
});

// rb:test authorized.denied
test('authorized.denied: a token one character off is the guard\'s 403', async () => {
  const response = await request(app.getHttpServer()).get('/authorized/small').set('authorization', `Bearer ${settings.wrongToken}`);

  expect(response.status).toBe(403);
  expect(response.body).toEqual({ message: 'Forbidden resource', error: 'Forbidden', statusCode: 403 });
});

test('no token is refused the same way', async () => {
  expect((await request(app.getHttpServer()).get('/authorized/small')).status).toBe(403);
});
