// RequestBench framework: NestJS as a Lambda function, on its Express adapter behind
// @codegenie/serverless-express, as Nest's serverless recipe runs it. The recipe creates the
// application on the first event, because a CommonJS handler cannot wait at the top of its module.
// This one is an ES module, so the application is created while the runtime loads it, before the
// function asks for its first event.
// The package's default export is its configure function, which TypeScript sees only by that name from
// an ES module.
import { configure as serverlessExpress } from '@codegenie/serverless-express';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';

import { AppModule } from '../Implementation/app.module.js';
import { configureExpress, express } from '../Implementation/express.js';
import { load } from '../Implementation/payloads.js';

const directory = process.env['RB_PAYLOADS'];
if (directory === undefined) throw new Error('RB_PAYLOADS has to name the payload directory');
const payloads = load(directory);

const app = await NestFactory.create<NestExpressApplication>(AppModule.register(payloads, express));
configureExpress(app, payloads);
await app.init();

export const handler = serverlessExpress({ app: app.getHttpAdapter().getInstance() });
