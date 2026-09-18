package rb.helidon;

import io.helidon.http.encoding.gzip.GzipEncoding;
import io.helidon.webserver.WebServer;
import io.helidon.webserver.WebServerConfig;
import io.helidon.webserver.http.HttpRouting;
import java.util.LinkedHashMap;
import java.util.Map;
import rb.domain.Domain;
import rb.domain.Errors;
import rb.helidon.routes.Authorized;
import rb.helidon.routes.Baseline;
import rb.helidon.routes.Body;
import rb.helidon.routes.Cache;
import rb.helidon.routes.Etag;
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
    WebServerConfig.Builder server = WebServer.builder()
                                              .port(Hosts.port())
                                              .routing(Main::routes);
    server(server);
    server.build().start();
    Hosts.listening();
    System.out.println("container/helidon-se listening on " + Hosts.port());
  }

  /**
   * Helidon's own content encoding, on the whole WebServer, with gzip from
   * helidon-http-encoding-gzip. It gzips any response whose request asks for it, with no size
   * floor, and has no level setting, so it runs at the JDK's default, which zlib runs as 6. Its
   * own method so the suite's server is set up the same way.
   */
  // rb:wiring compressed.*
  static void server(WebServerConfig.Builder server) {
    server.contentEncoding(encoding -> encoding.addContentEncoding(GzipEncoding.create()));
  }

  static void routes(HttpRouting.Builder r) {
    // errors: Helidon routes a raised exception to a handler by type, which is what lets a
    // handler raise and never build a 404 or a 422 itself. The router's own miss is a 404
    // Helidon answers before any handler, so it gets the body from the catch-all below.
    // rb:wiring errors.*
    r.error(Errors.NotFound.class, (req, res, ex) -> res.status(404).send(Domain.notFoundBody()));
    // rb:wiring errors.*,body.*
    r.error(Validation.Refused.class, (req, res, ex) ->
        res.status(422).send(Validation.refusedBody(ex.errors())));
    // A body Jackson could not read never reached the walk, so it names no field.
    // rb:wiring errors.*
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
    Etag.register(r);
    Cache.register(r);
    Body.register(r);
    DomainRoutes.register(r);
    Templates.register(r);

    // Registered last. Helidon matches in registration order, so a catch-all mounted
    // earlier would answer every route declared after it.
    //
    // rb:handler errors.unmatched
    r.any((req, res) -> res.status(404).send(Domain.notFoundBody()));
  }
}
