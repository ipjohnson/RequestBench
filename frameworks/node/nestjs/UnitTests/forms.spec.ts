import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';

import { expected, expressApp, run } from './app.js';

let app: NestExpressApplication;
beforeAll(async () => (app = await expressApp()));
afterAll(() => app.close());

// rb:test forms.urlencoded
test('forms.urlencoded: query.many\'s eight values from a form, the numbers as numbers', async () => {
  const response = await request(app.getHttpServer()).post('/forms/urlencoded').type('form').send(Object.fromEntries(Object.entries(run.search).map(([k, v]) => [k, String(v)])));

  expect(response.status).toBe(200);
  expect(response.body).toEqual(expected.withEcho('items.small.json', run.search));
});

// rb:test forms.multipart
test('forms.multipart: Multer reads the file to its end, and the fields are echoed', async () => {
  const file = expected.bytes('forms.file.txt');

  const response = await request(app.getHttpServer())
    .post('/forms/multipart')
    .field('tenant', run.tenant)
    .field('requestId', run.requestId)
    .attach('file', file, { filename: 'forms.file.txt', contentType: 'text/plain' });

  expect(response.status).toBe(200);
  expect(response.body).toEqual({ file: { name: 'forms.file.txt', bytes: file.length }, echo: { tenant: run.tenant, requestId: run.requestId } });
});
