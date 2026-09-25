import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';

import { expressApp } from './app.js';

let app: NestExpressApplication;
beforeAll(async () => (app = await expressApp()));
afterAll(() => app.close());

// errors: every refusal is Nest's own JSON, written by its exception filter. Nothing here reshapes any of them.

// rb:test errors.unmatched
test('errors.unmatched: a path no route matches is Nest\'s 404', async () => {
  const response = await request(app.getHttpServer()).get('/errors/unmatched');

  expect(response.status).toBe(404);
  expect(response.body).toEqual({ message: 'Cannot GET /errors/unmatched', error: 'Not Found', statusCode: 404 });
});

// rb:test errors.not_found
test('errors.not_found: an id with no row is NotFoundException\'s 404', async () => {
  const response = await request(app.getHttpServer()).get('/items/999999');

  expect(response.status).toBe(404);
  expect(response.body).toEqual({ message: 'Not Found', statusCode: 404 });
});

// rb:test errors.wrong_method
test('errors.wrong_method: Express\'s router matches the method with the path, so a method the path lacks is the same 404', async () => {
  const response = await request(app.getHttpServer()).post('/items/17');

  expect(response.status).toBe(404);
  expect(response.body).toEqual({ message: 'Cannot POST /items/17', error: 'Not Found', statusCode: 404 });
});

// rb:test errors.malformed
test('errors.malformed: a body that is not JSON is the body parser\'s 400, with JSON.parse\'s message', async () => {
  const response = await request(app.getHttpServer()).post('/body/validate/small').set('content-type', 'application/json').send('{"customerId": 1, "lines": [');

  expect(response.status).toBe(400);
  expect(response.body).toEqual({ message: 'Unexpected end of JSON input', error: 'Bad Request', statusCode: 400 });
});
