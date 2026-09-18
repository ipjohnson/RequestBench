package rb.vertx.routes;

import io.vertx.ext.web.Router;
import io.vertx.ext.web.RoutingContext;
import io.vertx.ext.web.validation.RequestParameter;
import io.vertx.ext.web.validation.RequestParameters;
import io.vertx.ext.web.validation.ValidationHandler;
import io.vertx.ext.web.validation.builder.Parameters;
import io.vertx.ext.web.validation.builder.ValidationHandlerBuilder;
import io.vertx.json.schema.SchemaRepository;
import rb.domain.Domain;
import rb.domain.Model.QueryMany;
import rb.domain.Model.QueryOne;
import rb.vertx.Reply;
import rb.vertx.Validation;

import static io.vertx.json.schema.common.dsl.Schemas.intSchema;
import static io.vertx.json.schema.common.dsl.Schemas.stringSchema;

/**
 * query: query string parsing, percent-decoding and coercion, with the values echoed beside the
 * small payload and put to no other use.
 *
 * Vert.x's own binding is the same facility as its validation: a ValidationHandler mounted on
 * the route ahead of the business handler, which parses and types each declared parameter and
 * fails the routing context itself when one does not fit. No handler coerces a string; it
 * reads the typed value back out of RequestParameters.
 *
 * optionalParam, so an absent parameter is not a refusal. What an absent one means is the
 * fallback below, which is the only thing this file decides.
 */
public final class Query {
  private Query() {}

  // rb:wiring query.*,domain.*
  private static ValidationHandler handler(SchemaRepository repository,
                                           String[] ints, String[] strings) {
    ValidationHandlerBuilder b = ValidationHandlerBuilder.create(repository);
    for (String name : ints) {
      b = b.queryParameter(Parameters.optionalParam(name, intSchema()));
    }
    for (String name : strings) {
      b = b.queryParameter(Parameters.optionalParam(name, stringSchema()));
    }
    return b.build();
  }

  private static RequestParameter value(RoutingContext ctx, String name) {
    RequestParameters params = ctx.get(ValidationHandler.REQUEST_CONTEXT_KEY);
    RequestParameter v = params.queryParameter(name);
    return v == null || v.isNull() ? null : v;
  }

  // rb:wiring query.*,domain.*
  static int qint(RoutingContext ctx, String name, int fallback) {
    RequestParameter v = value(ctx, name);
    return v == null ? fallback : v.getInteger();
  }

  static String qstr(RoutingContext ctx, String name) {
    RequestParameter v = value(ctx, name);
    return v == null ? "" : v.getString();
  }

  /** What domain.filter pages by, mounted by DomainRoutes on its own route. */
  public static ValidationHandler filterHandler() {
    return handler(Validation.repository(), new String[] {"page", "size"},
                   new String[] {"status"});
  }

  public static void register(Router router) {
    SchemaRepository repository = Validation.repository();

    router.get("/query/one")
          .handler(handler(repository, new String[] {"page"}, new String[] {}))
          .handler(ctx -> Reply.json(ctx, 200,
              Domain.withEcho("small", new QueryOne(qint(ctx, "page", 0)))))
          .failureHandler(Reply::failure);

    router.get("/query/many")
          .handler(handler(repository,
                           new String[] {"page", "size", "min_price", "max_price"},
                           new String[] {"status", "category", "sort", "q"}))
          .handler(ctx -> Reply.json(ctx, 200, Domain.withEcho("small", new QueryMany(
              qint(ctx, "page", 0), qint(ctx, "size", 0), qstr(ctx, "status"),
              qstr(ctx, "category"), qstr(ctx, "sort"), qstr(ctx, "q"),
              qint(ctx, "min_price", 0), qint(ctx, "max_price", 0)))))
          .failureHandler(Reply::failure);
  }
}
