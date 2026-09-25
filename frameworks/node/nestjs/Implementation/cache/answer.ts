import { type CallHandler, type ExecutionContext, Inject, Injectable, type NestInterceptor, SetMetadata } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { CacheInterceptor } from '@nestjs/cache-manager';
import { map, type Observable } from 'rxjs';

import { PAYLOADS, type Payloads } from '../payloads.js';

// rb:wiring cache.*
/**
 * What a cache route returns: its body and the headers it writes. CacheInterceptor stores the value
 * a handler returns, so the headers are stored with the body, and a replay writes them again.
 */
export interface Answer {
  readonly headers: Readonly<Record<string, string>>;
  readonly body: unknown;
}

/**
 * Adds an answer's headers to the ones the platform has written, such as CORS's Vary, and responds
 * with its body, whether the handler or the store gave it.
 */
@Injectable()
export class AnswerInterceptor implements NestInterceptor {
  constructor(private readonly adapterHost: HttpAdapterHost) {}

  intercept(context: ExecutionContext, next: CallHandler<Answer>): Observable<unknown> {
    const response: unknown = context.switchToHttp().getResponse();
    return next.handle().pipe(
      map((answer) => {
        for (const [name, value] of Object.entries(answer.headers)) this.adapterHost.httpAdapter.appendHeader(response, name, value);
        return answer.body;
      }),
    );
  }
}

/** Which of settings.json's vary lists a route is keyed on. */
export const VARY = 'rb:vary';
export const VaryOn = (list: 'one' | 'many') => SetMetadata(VARY, list);

/**
 * CacheInterceptor keyed on the URL, as it is by default, and on the values of the request headers
 * the route varies on, by overriding trackBy as Nest's caching guide does.
 */
@Injectable()
export class VaryCacheInterceptor extends CacheInterceptor {
  @Inject(PAYLOADS) private readonly payloads: Payloads;

  override async trackBy(context: ExecutionContext): Promise<string | undefined> {
    const url = await super.trackBy(context);
    const list = this.reflector.get<'one' | 'many' | undefined>(VARY, context.getHandler());
    if (url == null || list === undefined) return url ?? undefined;
    const headers = context.switchToHttp().getRequest<{ headers: Record<string, string | undefined> }>().headers;
    return [url, ...Object.keys(this.payloads.settings.cache.vary[list]).map((name) => headers[name] ?? '')].join('|');
  }
}
// rb:end

