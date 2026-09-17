package rb.helidon;

import io.helidon.webserver.WebServer;
import io.helidon.webserver.http.HttpRouting;
import java.util.LinkedHashMap;
import java.util.Map;
import rb.domain.Domain;
import rb.domain.Errors;
import rb.helidon.routes.Authorized;
import rb.helidon.routes.Baseline;
import rb.helidon.routes.Body;
import rb.helidon.routes.Cached;
import rb.helidon.routes.Compressed;
import rb.helidon.routes.DomainRoutes;
import rb.helidon.routes.Headers;
import rb.helidon.routes.JsonRoutes;
import rb.helidon.routes.Middleware;
import rb.helidon.routes.Parameters;
import rb.helidon.routes.Query;
import rb.helidon.routes.Templates;
import rb.hosts.Hosts;

/**
 * RequestBench target: Helidon SE. Framework wiring only; behaviour from rb-shared.
 *
 * One class per endpoint family, under routes/. Each registers its own routes and nothing
 * else is shared between them.
 */
public final class Main {
  private Main() {}

  public static void main(String[] args) throws Exception {
    Domain.load(Hosts.fixture());
    WebServer.builder()
             .port(Hosts.port())
             .routing(Main::routes)
             .build()
             .start();
    System.out.println("container/helidon-se listening on " + Hosts.port());
  }

  static void routes(HttpRouting.Builder r) {
    // errors: Helidon routes a raised exception to a handler by type, which is what lets a
    // handler raise and never build a 404 or a 422 itself. The router's own miss is a 404
    // Helidon answers before any handler, so it gets the body from the catch-all below.
    r.error(Errors.NotFound.class, (req, res, ex) -> res.status(404).send(Domain.notFoundBody()));
    r.error(Validation.Refused.class, (req, res, ex) ->
        res.status(422).send(Validation.refusedBody(ex.errors())));
    // A body Jackson could not read never reached the walk, so it names no field.
    r.error(Errors.Malformed.class, (req, res, ex) ->
        res.status(400).send(Validation.notBoundBody(ex.getMessage())));
    r.error(Exception.class, (req, res, ex) -> {
      Map<String, String> b = new LinkedHashMap<>(2);
      b.put("error", "internal");
      b.put("message", ex.getMessage() == null ? "internal" : ex.getMessage());
      res.status(500).send(b);
    });

    Baseline.register(r);
    JsonRoutes.register(r);
    Parameters.register(r);
    Query.register(r);
    Headers.register(r);
    Middleware.register(r);
    Authorized.register(r);
    Compressed.register(r);
    Cached.register(r);
    Body.register(r);
    DomainRoutes.register(r);
    Templates.register(r);

    // Registered last. Helidon matches in registration order, so a catch-all mounted
    // earlier would answer every route declared after it.
    //
    // rb:snippet errors.unmatched
    r.any((req, res) -> res.status(404).send(Domain.notFoundBody()));
  }
}
