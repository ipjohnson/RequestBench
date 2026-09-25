import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';

import { expected, expressApp, run } from './app.js';

let app: NestExpressApplication;
beforeAll(async () => (app = await expressApp()));
afterAll(() => app.close());

/** The three headers the binding rows bind, and as many more as asked that nothing reads. The many rows send twenty-five of those. */
const headers = (unread: number) => ({
  'x-rb-tenant': run.tenant,
  'x-rb-request-id': run.requestId,
  'x-rb-account': String(run.account),
  ...Object.fromEntries(Array.from({ length: unread }, (_, i) => [`x-rb-unread-${i}`, 'unread'])),
});

// rb:test headers.few,headers.many
for (const [id, unread] of [['headers.few', 0], ['headers.many', 25]] as const) {
  test(`${id}: headers nothing reads leave the answer alone`, async () => {
    const response = await request(app.getHttpServer()).get('/headers').set(headers(unread));

    expect(response.body).toEqual(expected.json('items.small.json'));
  });
}

// rb:test headers.bind_few,headers.bind_many
for (const [id, unread] of [['headers.bind_few', 0], ['headers.bind_many', 25]] as const) {
  test(`${id}: three headers are bound and echoed, the account as a number`, async () => {
    const response = await request(app.getHttpServer()).get('/headers/bind').set(headers(unread));

    expect(response.body).toEqual(expected.withEcho('items.small.json', { tenant: run.tenant, requestId: run.requestId, account: run.account }));
  });
}

test('an account that is no integer is refused with 400', async () => {
  const response = await request(app.getHttpServer()).get('/headers/bind').set({ ...headers(0), 'x-rb-account': 'many' });

  expect(response.status).toBe(400);
});
