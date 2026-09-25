// The Kiota client in Client/, generated from the document @nestjs/swagger writes, calling the
// Implementation over HTTP. These hold the client to what Nest answers, not Nest to a corpus row, so
// no name starts with a corpus id.
import { AnonymousAuthenticationProvider } from '@microsoft/kiota-abstractions';
import { DefaultRequestAdapter } from '@microsoft/kiota-bundle';
import type { NestExpressApplication } from '@nestjs/platform-express';

import { createNestClient, type NestClient } from '../Client/Kiota/nestClient.js';
import { expected, expressApp } from './app.js';

let app: NestExpressApplication;
let client: NestClient;
beforeAll(async () => {
  app = await expressApp();
  await app.listen(0, '127.0.0.1');
  const adapter = new DefaultRequestAdapter(new AnonymousAuthenticationProvider());
  adapter.baseUrl = await app.getUrl();
  client = createNestClient(adapter);
});
afterAll(() => app.close());

test('kiota: json.small is the payload, in additionalData because the payload is an interface', async () => {
  const answer = await client.json.small.get();

  expect(answer?.additionalData?.['count']).toBe(1);
  expect(answer?.additionalData?.['size']).toBe('small');
});

test('kiota: a row is read by its id', async () => {
  const answer = await client.items.byId(17).get();

  expect(answer?.additionalData?.['id']).toBe(17);
  expect(answer?.additionalData?.['name']).toBe(expected.row(17).name);
});

test('kiota: an order is sent as the CheckedOrder model', async () => {
  const answer = await client.body.validate.small.post({ customerId: 1, status: 'open', lines: [{ productId: 1, qty: 1 }] });

  expect(JSON.parse(new TextDecoder().decode(answer))).toMatchObject({ fields: 4, echo: { customerId: 1 } });
});

test('kiota: a rejected order is an error with the status', async () => {
  const refused = client.body.validate.small.post({ customerId: 0, status: '', lines: [] });

  await expect(refused).rejects.toMatchObject({ responseStatusCode: 400 });
});
