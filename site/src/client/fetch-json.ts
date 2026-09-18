// Reading one results document, which both kinds of page do.
//
// Its own module because source.ts brings the catalog's schema, and zod with it, into any page
// that imports it. A framework page reads a run and a wire capture and needs neither.

/**
 * Pages serves a .gz as application/gzip with no Content-Encoding, so the browser hands back
 * raw bytes and the stream has to be unwrapped here.
 */
export async function fetchJson<T>(url: string | URL): Promise<T | null> {
  const res = await fetch(url);
  if (!res.ok) return null;
  if (!String(url).endsWith(".gz")) return (await res.json()) as T;
  if (!res.body) return null;
  const stream = res.body.pipeThrough(new DecompressionStream("gzip"));
  return (await new Response(stream).json()) as T;
}
