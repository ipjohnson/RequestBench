import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';

import { expected, expressApp } from './app.js';

let app: NestExpressApplication;
beforeAll(async () => (app = await expressApp()));
afterAll(() => app.close());

// rb:test etag.small,etag.large
for (const [id, size] of [['etag.small', 'small'], ['etag.large', 'large']] as const) {
  test(`${id}: the answer carries the tag Express computed`, async () => {
    const response = await request(app.getHttpServer()).get(`/etag/${size}`);

    expect(response.status).toBe(200);
    expect(response.headers['etag']).toMatch(/^W\/"/);
    expect(response.body).toEqual(expected.json(`items.${size}.json`));
  });
}

// rb:test etag.match_large
test('etag.match_large: a matching If-None-Match is 304 with no body, after the handler ran', async () => {
  const first = await request(app.getHttpServer()).get('/etag/large');

  const response = await request(app.getHttpServer()).get('/etag/large').set('if-none-match', first.headers['etag']!);

  expect(response.status).toBe(304);
  expect(response.text).toBe('');
  expect(response.headers['x-rb-serial']).not.toBe(first.headers['x-rb-serial']);
});

// rb:test etag.stale_large
test('etag.stale_large: a tag that does not match is answered in full', async () => {
  const response = await request(app.getHttpServer()).get('/etag/large').set('if-none-match', '"0000000000000000"');

  expect(response.status).toBe(200);
  expect(response.body).toEqual(expected.json('items.large.json'));
});
