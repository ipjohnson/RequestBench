import { type CanActivate, type ExecutionContext, Inject, Injectable } from '@nestjs/common';

import { PAYLOADS, type Payloads } from '../payloads.js';

// rb:wiring authorized.*
/**
 * A guard, Nest's way to decide whether a request may reach its handler. It lets settings.json's
 * bearer token through, and Nest answers any other request with its 403.
 */
@Injectable()
export class BearerTokenGuard implements CanActivate {
  constructor(@Inject(PAYLOADS) private readonly payloads: Payloads) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{ headers: Record<string, string | undefined> }>();
    const [scheme, token] = (request.headers['authorization'] ?? '').split(' ');
    return scheme?.toLowerCase() === 'bearer' && token === this.payloads.settings.token;
  }
}
// rb:end
