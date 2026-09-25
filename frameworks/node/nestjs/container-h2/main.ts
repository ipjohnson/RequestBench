// RequestBench framework: NestJS on its Fastify adapter, answering HTTP/2 with prior knowledge
// through Fastify's own http2 option. One process, as Nest's listen starts it.
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';

import { AppModule } from '../Implementation/app.module.js';
import { configureFastify, fastify } from '../Implementation/fastify.js';
import { load } from '../Implementation/payloads.js';

const directory = process.env['RB_PAYLOADS'];
if (directory === undefined) throw new Error('RB_PAYLOADS has to name the payload directory');
const payloads = load(directory);

const app = await NestFactory.create<NestFastifyApplication>(AppModule.register(payloads, fastify), new FastifyAdapter({ http2: true }));
await configureFastify(app, payloads);
// Nest's shutdown hooks close the application on SIGTERM. As the container's first process, Node has
// no default action for it, and docker stop would wait out its timeout.
app.enableShutdownHooks();
await app.listen(Number(process.env['PORT'] ?? 8080), '0.0.0.0');
