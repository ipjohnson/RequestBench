import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';

import { expected, expressApp } from './app.js';

let app: NestExpressApplication;
beforeAll(async () => (app = await expressApp()));
afterAll(() => app.close());

// rb:test template.small,template.medium
for (const [id, size] of [['template.small', 'small'], ['template.medium', 'medium']] as const) {
  test(`${id}: the payload is rendered by the Handlebars view`, async () => {
    const response = await request(app.getHttpServer()).get(`/template/${size}`);

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toBe('text/html; charset=utf-8');
    expect(expected.normal(response.text)).toBe(expected.page(`items.${size}.json`));
  });
}

test('a render leaves the payload it was handed as it was', async () => {
  await request(app.getHttpServer()).get('/template/small');

  expect((await request(app.getHttpServer()).get('/json/small')).body).toEqual(expected.json('items.small.json'));
});
