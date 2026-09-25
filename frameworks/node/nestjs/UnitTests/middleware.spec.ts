import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';

import { expected, expressApp } from './app.js';

let app: NestExpressApplication;
beforeAll(async () => (app = await expressApp()));
afterAll(() => app.close());

// rb:test middleware.none,middleware.four,middleware.sixteen
for (const [id, layers] of [['middleware.none', 'none'], ['middleware.four', 'four'], ['middleware.sixteen', 'sixteen']] as const) {
  test(`${id}: the layers in front of the handler leave the answer alone`, async () => {
    const response = await request(app.getHttpServer()).get(`/middleware/${layers}`);

    expect(response.body).toEqual(expected.json('items.small.json'));
  });
}
