import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';

import { expected, expressApp } from './app.js';

let app: NestExpressApplication;
beforeAll(async () => (app = await expressApp()));
afterAll(() => app.close());

const get = (size: string, encoding: string) =>
  request(app.getHttpServer()).get(`/compressed/${size}`).set({ 'accept-encoding': encoding, 'cache-control': 'no-cache' });

// rb:test compressed.gzip_large
test('compressed.gzip_large: a large body is gzipped when asked', async () => {
  const response = await get('large', 'gzip');

  // supertest inflates the body and keeps the header that says it was gzipped.
  expect(response.headers['content-encoding']).toBe('gzip');
  expect(response.body).toEqual(expected.json('items.large.json'));
});

// rb:test compressed.gzip_small
test('compressed.gzip_small: a body under the 1 kB threshold goes out as it is', async () => {
  const response = await get('small', 'gzip');

  expect(response.headers['content-encoding']).toBeUndefined();
  expect(response.body).toEqual(expected.json('items.small.json'));
});

// rb:test compressed.identity_small,compressed.identity_large
for (const [id, size] of [['compressed.identity_small', 'small'], ['compressed.identity_large', 'large']] as const) {
  test(`${id}: identity is answered as it is, and the handler runs every time`, async () => {
    const first = await get(size, 'identity');
    const second = await get(size, 'identity');

    expect(second.headers['content-encoding']).toBeUndefined();
    expect(second.body).toEqual(expected.json(`items.${size}.json`));
    expect(Number(second.headers['x-rb-serial'])).toBeGreaterThan(Number(first.headers['x-rb-serial']));
  });
}

test('compression covers the whole application, as Nest installs it', async () => {
  const response = await request(app.getHttpServer()).get('/json/large').set('accept-encoding', 'gzip');

  expect(response.headers['content-encoding']).toBe('gzip');
});
