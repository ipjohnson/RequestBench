// RequestBench framework: NestJS on its Express adapter. One process, as Nest's listen starts it.
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
// Nest's shutdown hooks close the application on SIGTERM. As the container's first process, Node has
// no default action for it, and docker stop would wait out its timeout.
app.enableShutdownHooks();
await app.listen(Number(process.env['PORT'] ?? 8080), '0.0.0.0');
