import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';

import { expected, expressApp } from './app.js';

let app: NestExpressApplication;
beforeAll(async () => (app = await expressApp()));
afterAll(() => app.close());

// rb:test static.small,static.medium,static.large
for (const [id, name] of [['static.small', 'items.small.json'], ['static.medium', 'items.medium.json'], ['static.large', 'items.large.json']] as const) {
  test(`${id}: the committed file is served byte for byte`, async () => {
    const file = expected.bytes(name);

    const response = await request(app.getHttpServer()).get(`/static/${name}`);

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toMatch(/^application\/json/);
    expect(response.headers['last-modified']).toBeDefined();
    expect(response.text).toBe(file.toString('utf8'));
  });
}
