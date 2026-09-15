package rb.helidon.routes;

import io.helidon.webserver.http.HttpRouting;
import rb.domain.Domain;
import rb.helidon.Reply;

/**
 * cached: validator headers and the conditional request.
 *
 * The ETag is pinned in the fixture, so this measures emitting the header and comparing it
 * rather than hashing the body. The size is closed over rather than read back out of the
 * path, and the comparison requires a non-empty header: matching a missing if-none-match
 * against an empty ETag answers 304 to a client that never asked a conditional question.
 */
public final class Cached {
  private Cached() {}

  public static void register(HttpRouting.Builder r) {
    // rb:snippet cached.small cached.medium cached.large cached.revalidate
    for (String size : new String[] {"small", "medium", "large"}) {
      String etag = Domain.etagOf(size);
      r.get("/cached/" + size, (req, res) -> {
        res.header("etag", etag);
        res.header("cache-control", Domain.CACHEABLE);
        res.header("x-rb-serial", Domain.nextSerial());
        String inm = req.headers().value(io.helidon.http.HeaderNames.IF_NONE_MATCH).orElse("");
        if (!inm.isEmpty() && inm.equals(etag)) {
          Reply.noBody(res, 304);
          return;
        }
        res.send(Domain.payload(size));
      });
    }
  }
}
