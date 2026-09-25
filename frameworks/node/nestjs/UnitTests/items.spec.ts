import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';

import { expected, expressApp } from './app.js';

let app: NestExpressApplication;
beforeAll(async () => (app = await expressApp()));
afterAll(() => app.close());

const json = (method: 'post' | 'put' | 'patch', url: string, body: string) => request(app.getHttpServer())[method](url).set('content-type', 'application/json').send(body);

// rb:test items.read
test('items.read: a row is read by the id in the path', async () => {
  const response = await request(app.getHttpServer()).get('/items/17');

  expect(response.status).toBe(200);
  expect(response.body).toEqual(expected.row(17));
});

// rb:test items.head
test('items.head: Express answers HEAD with the GET route, and no body', async () => {
  const response = await request(app.getHttpServer()).head('/items/17');

  expect(response.status).toBe(200);
  expect(response.headers['content-type']).toMatch(/^application\/json/);
  expect(response.text).toBeUndefined();
});

// rb:test items.create
test('items.create: a created item is the row after the last', async () => {
  const response = await json('post', '/items', expected.text('items.new.json'));

  expect(response.status).toBe(201);
  expect(response.headers['location']).toBe('/items/1426');
  expect(response.body).toEqual({ id: 1426, ...expected.json('items.new.json') });
});

// rb:test items.replace
test('items.replace: a replaced item takes the id in the path', async () => {
  const response = await json('put', '/items/17', expected.text('items.new.json'));

  expect(response.body).toEqual({ id: 17, ...expected.json('items.new.json') });
});

// rb:test items.update
test('items.update: a patch is merged onto the row', async () => {
  const response = await json('patch', '/items/17', expected.text('items.patch.json'));

  expect(response.body).toEqual({ ...expected.row(17), ...expected.json('items.patch.json') });
});

// rb:test items.delete
test('items.delete: a delete is answered 204 with no body', async () => {
  const response = await request(app.getHttpServer()).delete('/items/17');

  expect(response.status).toBe(204);
  expect(response.text).toBe('');
});

test('a patch or a delete of a missing row is 404', async () => {
  expect((await json('patch', '/items/999999', expected.text('items.patch.json'))).status).toBe(404);
  expect((await request(app.getHttpServer()).delete('/items/999999')).status).toBe(404);
});

test('a created item missing a field is ValidationPipe\'s 400', async () => {
  const response = await json('post', '/items', '{"name":"a","category":"b","priceCents":1}');

  expect(response.status).toBe(400);
  expect(response.body.message).toEqual(['inStock must be a boolean value']);
});
