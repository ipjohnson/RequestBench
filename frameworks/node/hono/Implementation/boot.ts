/**
 * What the start module knows and /__meta reports: the milliseconds from the start of the process
 * to the server listening, which the suite never reaches, and the adapter, where it is not
 * @hono/node-server.
 */
export const boot: { ms?: number; adapter?: string } = {};
