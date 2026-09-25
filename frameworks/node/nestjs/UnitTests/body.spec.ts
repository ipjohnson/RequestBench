import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';

import { expected, expressApp } from './app.js';

let app: NestExpressApplication;
beforeAll(async () => (app = await expressApp()));
afterAll(() => app.close());

const post = (url: string, body: string) => request(app.getHttpServer()).post(url).set('content-type', 'application/json').send(body);

/** ValidationPipe's refusal, with a message for each rule the body breaks. */
const refused = (...message: string[]) => ({ message, error: 'Bad Request', statusCode: 400 });

// rb:test body.bind_small,body.bind_medium,body.validate_small,body.validate_medium
for (const [id, url, file] of [
  ['body.bind_small', '/body/bind/small', 'order.small.json'],
  ['body.bind_medium', '/body/bind/medium', 'order.medium.json'],
  ['body.validate_small', '/body/validate/small', 'order.small.json'],
  ['body.validate_medium', '/body/validate/medium', 'order.medium.json'],
] as const) {
  test(`${id}: an order is answered with its leaves, its length and itself`, async () => {
    const body = expected.text(file);

    const response = await post(url, body);

    const order = expected.json(file) as { lines: unknown[] };
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ fields: 2 + 2 * order.lines.length, bytes: Buffer.byteLength(body), echo: order });
  });
}

// rb:test body.rejected_all
test('body.rejected_all: ValidationPipe refuses order.invalid with every rule it breaks', async () => {
  const response = await post('/body/validate/small', expected.text('order.invalid.json'));

  expect(response.status).toBe(400);
  expect(response.body).toEqual(refused('customerId must not be less than 1', 'status should not be empty', 'lines must contain at least 1 elements'));
});

// rb:test body.rejected_first
test('body.rejected_first: the first-error route stops at the first rule the order breaks', async () => {
  const response = await post('/body/validate/first-error', expected.text('order.invalid.json'));

  expect(response.status).toBe(400);
  expect(response.body).toEqual(refused('customerId must not be less than 1'));
});

test('the first-error route answers the message the full check lists first', async () => {
  const body = '{"customerId":1,"status":"","lines":[{"productId":1,"qty":0}]}';

  const first = (await post('/body/validate/first-error', body)).body.message;
  const every = (await post('/body/validate/small', body)).body.message;

  expect(first).toEqual(every.slice(0, 1));
  expect(every).toEqual(['status should not be empty', 'lines.0.qty must not be less than 1']);
});

test('the first-error route binds a valid order', async () => {
  const response = await post('/body/validate/first-error', expected.text('order.small.json'));

  expect(response.status).toBe(200);
  expect(response.body.echo).toEqual(expected.json('order.small.json'));
});

test('the bind routes check no rule', async () => {
  const response = await post('/body/bind/small', expected.text('order.invalid.json'));

  expect(response.status).toBe(200);
  expect(response.body.fields).toBe(2);
});
