import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';

import { expected, expressApp } from './app.js';

// Each file gets its own application, and so its own store.
let app: NestExpressApplication;
beforeAll(async () => (app = await expressApp()));
afterAll(() => app.close());

const get = (url: string, headers: Record<string, string> = {}) => request(app.getHttpServer()).get(url).set(headers);
/** x-rb-serial, after checking it starts with the Unix time in milliseconds it was written at. */
const serial = async (url: string, headers: Record<string, string> = {}) => {
  const value = String((await get(url, headers)).headers['x-rb-serial']);
  const form = /^(\d+)\|\d+$/.exec(value);
  expect(form, `x-rb-serial ${value} is not <time stamp>|<count>`).not.toBeNull();
  expect(Date.now() - Number(form![1])).toBeLessThan(60_000);
  return value;
};

// rb:test cache.small,cache.medium,cache.large
for (const [id, size] of [['cache.small', 'small'], ['cache.medium', 'medium'], ['cache.large', 'large']] as const) {
  test(`${id}: a second request for a key is its stored answer, with the serial it was stored with`, async () => {
    const first = await get(`/cache/${size}/k1`);
    const second = await get(`/cache/${size}/k1`);

    expect(second.body).toEqual(expected.json(`items.${size}.json`));
    expect(second.headers['x-rb-serial']).toBe(first.headers['x-rb-serial']);
    expect(await serial(`/cache/${size}/k2`)).not.toBe(first.headers['x-rb-serial']);
    expect(second.headers['x-cache']).toBe('HIT');
  });
}

// rb:test cache.vary_one
test('cache.vary_one: one vary header keys the store', async () => {
  const alpha = await serial('/cache/vary/one/k1', { 'x-rb-tenant': 'alpha' });
  const beta = await serial('/cache/vary/one/k1', { 'x-rb-tenant': 'beta' });

  expect(await serial('/cache/vary/one/k1', { 'x-rb-tenant': 'alpha' })).toBe(alpha);
  expect(alpha).not.toBe(beta);
});

// rb:test cache.vary_many
test('cache.vary_many: each of three vary headers keys the store', async () => {
  const webEuAlpha = { 'x-rb-channel': 'web', 'x-rb-region': 'eu', 'x-rb-tenant': 'alpha' };

  const first = await serial('/cache/vary/many/k1', webEuAlpha);

  expect(await serial('/cache/vary/many/k1', webEuAlpha)).toBe(first);
  expect(await serial('/cache/vary/many/k1', { ...webEuAlpha, 'x-rb-tenant': 'beta' })).not.toBe(first);
  expect(await serial('/cache/vary/many/k1', { ...webEuAlpha, 'x-rb-region': 'us' })).not.toBe(first);
});

test('a replay says what it varies on, beside CORS and compression', async () => {
  await get('/cache/vary/many/k1');

  expect((await get('/cache/vary/many/k1')).headers['vary']).toBe('Origin, x-rb-channel, x-rb-region, x-rb-tenant, Accept-Encoding');
});

test('a route outside the family is never stored', async () => {
  expect(await serial('/compressed/small')).not.toBe(await serial('/compressed/small'));
});
