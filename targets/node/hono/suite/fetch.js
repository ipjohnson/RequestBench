// rb:test *
/**
 * The target, driven through app.request(), which is what Hono's testing guide reaches for.
 *
 * app.request() builds a Request and hands it to the application's own fetch handler, so the
 * Response that comes back is the one the application made: no server, no socket, and nothing
 * in between to decode it. The guide runs it under Vitest, so this suite installs Vitest and
 * nothing else.
 *
 * The compressed family's codec is Hono's own compress middleware, mounted on those paths
 * alone, which is inside the application and reached.
 */
import { app } from "../app.js";
import { captureFor, resolved } from "./planned.js";

/** Send one of an endpoint's planned requests. */
export async function send(a, headers = a.headers) {
  const r = await app.request(a.path, { method: a.method, headers, body: a.body ?? undefined });
  return {
    status: r.status,
    contentType: r.headers.get("content-type") ?? "",
    encoding: r.headers.get("content-encoding") ?? "",
    raw: Buffer.from(await r.arrayBuffer()),
    headers: Object.fromEntries(r.headers),
  };
}

/** Ask for the validator first, then send the request that carries it. */
export async function sendAfterCapture(a) {
  const { method, path, header } = captureFor(a);
  const first = await app.request(path, { method });
  return send(a, resolved(a, first.headers.get(header) ?? ""));
}
// rb:end
