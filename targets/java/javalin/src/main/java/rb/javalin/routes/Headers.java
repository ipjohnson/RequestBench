package rb.javalin.routes;

import com.fasterxml.jackson.annotation.JsonProperty;
import io.javalin.config.JavalinConfig;
import rb.domain.Domain;

/**
 * headers: the request header map, left unread and then bound.
 *
 * /headers reads no header at all, so headers.many minus headers.few is the cost of
 * materialising the 25 nobody asked for. /headers/bind binds three with Javalin's own
 * binding: headerAsClass names the header and the class it wants, and returns a Validator
 * that has already run Javalin's converter for that type, the way the query family converts.
 */
public final class Headers {
  private Headers() {}

  record Bound(String tenant, @JsonProperty("request_id") String requestId, int account) {}

  public static void register(JavalinConfig cfg) {
    cfg.routes.get("/headers", ctx -> ctx.json(Domain.payload("small")));

    cfg.routes.get("/headers/bind", ctx -> ctx.json(Domain.withEcho("small", new Bound(
        ctx.headerAsClass("x-rb-tenant", String.class).get(),
        ctx.headerAsClass("x-rb-request-id", String.class).get(),
        ctx.headerAsClass("x-rb-account", Integer.class).get()))));
  }
}
