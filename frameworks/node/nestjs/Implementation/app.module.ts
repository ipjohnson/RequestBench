import { CacheModule } from '@nestjs/cache-manager';
import { type DynamicModule, Module } from '@nestjs/common';
import { ServeStaticModule } from '@nestjs/serve-static';
import { KeyvCacheableMemory } from 'cacheable';
import { Keyv } from 'keyv';

import { AuthorizedController } from './authorized/authorized.controller.js';
import { BaselineController } from './baseline/baseline.controller.js';
import { BodyController } from './body/body.controller.js';
import { CacheController } from './cache/cache.controller.js';
import { CompressedController } from './compressed/compressed.controller.js';
import { ContractController } from './contract/contract.controller.js';
import { CorsController } from './cors/cors.controller.js';
import { EtagController } from './etag/etag.controller.js';
import { FormsController } from './forms/forms.controller.js';
import { HeadersController } from './headers/headers.controller.js';
import { ItemsController } from './items/items.controller.js';
import { JsonController } from './json/json.controller.js';
import { MiddlewareModule } from './middleware/middleware.module.js';
import { ParametersController } from './parameters/parameters.controller.js';
import { PAYLOADS, type Payloads } from './payloads.js';
import { PLATFORM, type Platform } from './platform.js';
import { QueryController } from './query/query.controller.js';
import { SseController } from './sse/sse.controller.js';
import { StreamController } from './stream/stream.controller.js';
import { TemplateController } from './template/template.controller.js';

/**
 * The application: one controller per corpus family, and the modules some families use. It is a
 * dynamic module, because the payloads configure the cache store and the static files, and the
 * platform the host runs gives the multipart route's controller. The errors family has no controller:
 * its answers are the router's, the body parser's and the items controller's.
 */
@Module({})
export class AppModule {
  static register(payloads: Payloads, platform: Platform): DynamicModule {
    const cache = payloads.settings.cache;
    return {
      module: AppModule,
      global: true,
      imports: [
        MiddlewareModule,
        // rb:wiring cache.*
        // An in-memory store sized in entries and aged by settings.json, as Nest's caching guide sets one up.
        CacheModule.register({ stores: [new Keyv({ store: new KeyvCacheableMemory({ ttl: cache.ttlSeconds * 1000, lruSize: cache.capacity }) })] }),
        // rb:handler static.file
        // rb:wiring static.*
        // renderPath is where ServeStaticModule answers index.html for a single-page application. The
        // payload directory holds none, and no request asks for this path.
        ServeStaticModule.forRoot({ rootPath: payloads.directory, serveRoot: '/static', renderPath: '/no-index' }),
        // rb:end
      ],
      controllers: [
        ContractController,
        BaselineController,
        JsonController,
        ParametersController,
        QueryController,
        HeadersController,
        BodyController,
        AuthorizedController,
        ItemsController,
        CacheController,
        EtagController,
        CompressedController,
        CorsController,
        FormsController,
        platform.uploads,
        StreamController,
        SseController,
        TemplateController,
      ],
      providers: [
        { provide: PAYLOADS, useValue: payloads },
        { provide: PLATFORM, useValue: platform },
      ],
      exports: [PAYLOADS, PLATFORM],
    };
  }
}
