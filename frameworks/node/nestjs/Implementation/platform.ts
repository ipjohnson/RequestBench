import type { Type } from '@nestjs/common';

/**
 * What the HTTP platform a host runs Nest on gives the application. Nest's upload interceptors
 * come from the platform's own package, so the multipart route's controller is made with the
 * platform's FileInterceptor.
 */
export interface Platform {
  /** The platform and its version, which /__meta reports as the adapter. */
  readonly adapter: string;
  /** The controller of /forms/multipart. */
  readonly uploads: Type;
}

/** The injection token the platform is provided under. */
export const PLATFORM = Symbol('PLATFORM');
