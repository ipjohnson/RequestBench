import type { FastifyReply } from "fastify";

let last = 0;

/**
 * x-rb-serial: the Unix time in milliseconds, a bar, and one counter for the whole process. A
 * handler that writes it increments the counter and writes both, so an answer the cache family
 * replays carries the value it was stored with.
 */
export function serial(reply: FastifyReply): void {
  reply.header("x-rb-serial", `${Date.now()}|${++last}`);
}

/** The answer, with x-rb-serial written to show the handler ran for it. */
export function fresh<T>(reply: FastifyReply, answer: T): T {
  serial(reply);
  return answer;
}
