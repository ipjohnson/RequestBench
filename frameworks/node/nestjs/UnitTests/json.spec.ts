import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';

import { expected, expressApp } from './app.js';

let app: NestExpressApplication;
beforeAll(async () => (app = await expressApp()));
afterAll(() => app.close());

// rb:test json.small,json.medium,json.large
for (const [id, size] of [['json.small', 'small'], ['json.medium', 'medium'], ['json.large', 'large']] as const) {
  test(`${id}: the payload goes out as JSON`, async () => {
    const response = await request(app.getHttpServer()).get(`/json/${size}`);

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
    expect(response.body).toEqual(expected.json(`items.${size}.json`));
  });
}

test('Express tags every answer with a weak ETag', async () => {
  expect((await request(app.getHttpServer()).get('/json/small')).headers['etag']).toMatch(/^W\//);
});
