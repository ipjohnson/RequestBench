// rb:test *
/**
 * The target, driven through fastify.inject(), which Fastify's own testing guide leads with.
 *
 * inject() is light-my-request, which ships with Fastify: it builds a fake request, hands it
 * to the router and collects the reply, with no server and no socket. Fastify's guide runs it
 * under node:test, which is built into Node, so this suite installs nothing and has no
 * package.json of its own.
 *
 * The compressed family's codec is @fastify/compress, registered in its own encapsulated scope,
 * which is inside the request lifecycle and reached by an injected request. inject() does not
 * decode gzip, and rawPayload is the bytes as the reply wrote them.
 */
import { app } from "../app.js";
import { captureFor, resolved } from "./planned.js";

/** Send one of an endpoint's planned requests. */
export async function send(a, headers = a.headers) {
  const r = await app.inject({ method: a.method, url: a.path, headers, payload: a.body ?? undefined });
  return {
    status: r.statusCode,
    contentType: r.headers["content-type"] ?? "",
    encoding: r.headers["content-encoding"] ?? "",
    raw: r.rawPayload,
    headers: r.headers,
  };
}

/** Ask for the validator first, then send the request that carries it. */
export async function sendAfterCapture(a) {
  const { method, path, header } = captureFor(a);
  const first = await app.inject({ method, url: path });
  return send(a, resolved(a, first.headers[header] ?? ""));
}
// rb:end
