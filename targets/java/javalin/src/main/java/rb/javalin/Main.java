package rb.javalin;

import io.javalin.Javalin;
import io.javalin.config.JavalinConfig;
import io.javalin.json.JsonMapper;
import java.io.ByteArrayInputStream;
import java.io.InputStream;
import java.lang.reflect.Type;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import rb.domain.Domain;
import rb.domain.Errors;
import rb.domain.Json;
import rb.hosts.Hosts;
import rb.javalin.routes.Authorized;
import rb.javalin.routes.Baseline;
import rb.javalin.routes.Body;
import rb.javalin.routes.Cached;
import rb.javalin.routes.Compressed;
import rb.javalin.routes.DomainRoutes;
import rb.javalin.routes.Headers;
import rb.javalin.routes.JsonRoutes;
import rb.javalin.routes.Middleware;
import rb.javalin.routes.Parameters;
import rb.javalin.routes.Query;
import rb.javalin.routes.Templates;

/**
 * RequestBench target: Javalin. Framework wiring only; behaviour from rb-shared.
 *
 * One class per endpoint family, under routes/. Each registers its own routes and nothing
 * else is shared between them. Forty-five handlers in one file is a file nobody reads, and
 * a family is the unit a rewiring or a rerun is scoped to.
 */
public final class Main {
  private Main() {}

  /**
   * Javalin's own Jackson integration, handed the shared ObjectMapper so the serializer
   * library is identical to every other Java target and only the integration differs.
   */
  private static final JsonMapper MAPPER = new JsonMapper() {
    @Override
    public String toJsonString(Object obj, Type type) {
      return new String(Json.bytes(obj), StandardCharsets.UTF_8);
    }

    @Override
    public InputStream toJsonStream(Object obj, Type type) {
      return new ByteArrayInputStream(Json.bytes(obj));
    }

    @Override
    public <T> T fromJsonString(String json, Type type) {
      try {
        return Json.MAPPER.readValue(json, Json.MAPPER.constructType(type));
      } catch (Exception e) {
        throw new IllegalArgumentException("json", e);
      }
    }
  };

  public static void main(String[] args) throws Exception {
    Domain.load(Hosts.fixture());
    Javalin.create(Main::configure).start(Hosts.port());
  }

  static void configure(JavalinConfig cfg) {
    cfg.jsonMapper(MAPPER);
    cfg.startup.showJavalinBanner = false;

    // errors: every failure a handler raises, plus the router's own miss. An unmatched path
    // never reaches a handler, so its 404 comes from the error hook rather than the
    // exception one.
    //
    // rb:snippet errors.unmatched
    cfg.routes
       .exception(Errors.NotFound.class, (e, ctx) -> ctx.status(404).json(Domain.notFoundBody()))
       .exception(Errors.Validation.class,
                  (e, ctx) -> ctx.status(422).json(Domain.invalidBody(e.errors())))
       .exception(Exception.class, (e, ctx) -> ctx.status(500)
           .json(Map.of("error", "internal",
                        "message", e.getMessage() == null ? "internal" : e.getMessage())))
       .error(404, "*", ctx -> ctx.json(Domain.notFoundBody()));

    Baseline.register(cfg);
    JsonRoutes.register(cfg);
    Parameters.register(cfg);
    Query.register(cfg);
    Headers.register(cfg);
    Middleware.register(cfg);
    Authorized.register(cfg);
    Compressed.register(cfg);
    Cached.register(cfg);
    Body.register(cfg);
    DomainRoutes.register(cfg);
    Templates.register(cfg);
  }
}
