package rb.vertx.routes;

import com.fasterxml.jackson.annotation.JsonProperty;
import io.vertx.ext.web.Router;
import io.vertx.ext.web.validation.RequestParameters;
import io.vertx.ext.web.validation.ValidationHandler;
import io.vertx.ext.web.validation.builder.Parameters;
import io.vertx.ext.web.validation.builder.ValidationHandlerBuilder;
import rb.domain.Domain;
import rb.vertx.Reply;
import rb.vertx.Validation;

import static io.vertx.json.schema.common.dsl.Schemas.intSchema;
import static io.vertx.json.schema.common.dsl.Schemas.stringSchema;

/**
 * headers: the request header map, left unread and then bound.
 *
 * /headers reads no header at all, so headers.many minus headers.few is the cost of
 * materialising the 25 nobody asked for. /headers/bind binds three with the facility the
 * query family binds with: a ValidationHandler mounted ahead of the business handler, which
 * parses and types each declared header and fails the routing context itself when one does
 * not fit. The handler reads the typed values back out of RequestParameters.
 */
public final class Headers {
  private Headers() {}

  record Bound(String tenant, @JsonProperty("request_id") String requestId, int account) {}

  // rb:wiring headers.*
  private static ValidationHandler bound() {
    return ValidationHandlerBuilder.create(Validation.repository())
        .headerParameter(Parameters.param("x-rb-tenant", stringSchema()))
        .headerParameter(Parameters.param("x-rb-request-id", stringSchema()))
        .headerParameter(Parameters.param("x-rb-account", intSchema()))
        .build();
  }

  public static void register(Router router) {
    router.get("/headers").handler(ctx -> Reply.json(ctx, 200, Domain.payload("small")));

    router.get("/headers/bind")
          .handler(bound())
          .handler(ctx -> {
            RequestParameters params = ctx.get(ValidationHandler.REQUEST_CONTEXT_KEY);
            Reply.json(ctx, 200, Domain.withEcho("small", new Bound(
                params.headerParameter("x-rb-tenant").getString(),
                params.headerParameter("x-rb-request-id").getString(),
                params.headerParameter("x-rb-account").getInteger())));
          })
          .failureHandler(Reply::failure);
  }
}
