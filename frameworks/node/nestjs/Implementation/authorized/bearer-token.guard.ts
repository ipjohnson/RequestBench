import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';

// rb:wiring authorized.*
/**
 * A guard, Nest's way to decide whether a request may reach its handler. It lets one bearer token
 * through, and Nest answers any other request with its 403.
 */
@Injectable()
export class BearerTokenGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{ headers: Record<string, string | undefined> }>();
    const [scheme, token] = (request.headers['authorization'] ?? '').split(' ');
    return scheme?.toLowerCase() === 'bearer' && token === '5a7cc77ed0dcb825806b6f872026c317';
  }
}
// rb:end
