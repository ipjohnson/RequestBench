package rb.helidon.routes;

import io.helidon.http.HeaderNames;
import io.helidon.webserver.http.Handler;
import io.helidon.webserver.http.HttpRouting;
import rb.domain.Domain;
import rb.domain.Json;

/**
 * etag: one handler per route, built by the factory below.
 *
 * Helidon SE ships no conditional handling, so the digest is the shared one and /__meta
 * says so. Its filters run before a handler and cannot change a response once send() has
 * been called, so the conditional is a handler and the route is where it is attached, which
 * is the closest thing this framework has to the filter the servlet stacks scope by url
 * pattern.
 *
 * Shallow, which is the point: the body is serialized and hashed before anything is
 * compared, so the 304 saves the write and nothing else.
 */
public final class Etag {
  private Etag() {}

  private static Handler revalidating(String size) {
    return (req, res) -> {
      byte[] raw = Json.bytes(Domain.payload(size));
      String etag = Domain.contentETag(raw);
      res.header(HeaderNames.ETAG.defaultCase(), etag);
      res.header(HeaderNames.CACHE_CONTROL.defaultCase(), Domain.CACHEABLE);
      res.header("x-rb-serial", Domain.nextSerial());
      if (etag.equals(req.headers().value(HeaderNames.IF_NONE_MATCH).orElse(null))) {
        res.status(304).send();
        return;
      }
      res.header(HeaderNames.CONTENT_TYPE.defaultCase(), "application/json");
      res.send(raw);
    };
  }

  public static void register(HttpRouting.Builder r) {
    // rb:snippet etag.small etag.large etag.match_large etag.stale_large
    for (String size : new String[] {"small", "large"}) {
      r.get("/etag/" + size, revalidating(size));
    }
  }
}
