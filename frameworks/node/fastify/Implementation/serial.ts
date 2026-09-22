import type { FastifyReply } from "fastify";

let last = 0;

/**
 * x-rb-serial: one counter for the whole process. A handler that writes it increments it and
 * writes the new value, so an answer the cache family replays carries the value it was stored with.
 */
export function serial(reply: FastifyReply): void {
  reply.header("x-rb-serial", String(++last));
}

/** The answer, with x-rb-serial written to show the handler ran for it. */
export function fresh<T>(reply: FastifyReply, answer: T): T {
  serial(reply);
  return answer;
}
