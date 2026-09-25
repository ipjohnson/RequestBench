// Writes the OpenAPI document @nestjs/swagger builds from the application's controllers, without
// listening. nest build -c nest-cli.client.json compiles it with @nestjs/swagger's CLI plugin, which
// records each DTO's properties and each handler's return type as it compiles them. The image is
// built without the plugin.
import { writeFileSync } from 'node:fs';

import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

import { AppModule } from '../Implementation/app.module.js';
import { express } from '../Implementation/express.js';
import { load } from '../Implementation/payloads.js';

const directory = process.env['RB_PAYLOADS'];
if (directory === undefined) throw new Error('RB_PAYLOADS has to name the payload directory');

const app = await NestFactory.create<NestExpressApplication>(AppModule.register(load(directory), express), { logger: false });
const document = SwaggerModule.createDocument(app, new DocumentBuilder().setTitle('NestJS').setVersion('1.0.0').build());
writeFileSync('Client/openapi.json', `${JSON.stringify(document, null, 2)}\n`);
await app.close();
