package rb.vertx;

import io.vertx.core.json.JsonArray;
import io.vertx.core.json.JsonObject;
import io.vertx.ext.web.Router;
import io.vertx.ext.web.validation.BadRequestException;
import io.vertx.ext.web.validation.ValidationHandler;
import io.vertx.ext.web.validation.builder.Bodies;
import io.vertx.ext.web.validation.builder.ValidationHandlerBuilder;
import io.vertx.json.schema.Draft;
import io.vertx.json.schema.JsonSchemaOptions;
import io.vertx.json.schema.SchemaRepository;
import java.util.ArrayList;
import java.util.List;
import rb.domain.Domain;
import rb.domain.Model.LineInput;
import rb.domain.Model.ValidatedOrder;

import static io.vertx.json.schema.common.dsl.Schemas.arraySchema;
import static io.vertx.json.schema.common.dsl.Schemas.intSchema;
import static io.vertx.json.schema.common.dsl.Schemas.objectSchema;
import static io.vertx.json.schema.common.dsl.Schemas.stringSchema;
import static io.vertx.json.schema.common.dsl.Keywords.minItems;
import static io.vertx.json.schema.common.dsl.Keywords.minimum;

/**
 * Vert.x's own validation: a ValidationHandler mounted on the route.
 *
 * vertx-web-validation is a handler, not a call: it is attached to the route ahead of the
 * business handler, validates the body against a JSON schema, and fails the routing context
 * itself when the body does not fit. No handler calls a validator, and the business handler
 * only ever sees a body that passed.
 *
 * The schema is built with the DSL rather than written as JSON so it is checked at compile
 * time, which is the same reason the other targets annotate a record.
 */
public final class Validation {
  private Validation() {}

  /** One ValidationHandler, built once and mounted on each route that needs it. */
  // rb:wiring body.*,domain.*
  public static ValidationHandler orderHandler(Router router) {
    SchemaRepository repository = repository();
    return ValidationHandlerBuilder
        .create(repository)
        .body(Bodies.json(objectSchema()
            .requiredProperty("customer_id", intSchema())
            .requiredProperty("status", stringSchema())
            .requiredProperty("lines", arraySchema()
                .with(minItems(1))
                .items(objectSchema()
                    .requiredProperty("product_id", intSchema())
                    .requiredProperty("qty", intSchema().with(minimum(1)))))))
        .build();
  }

  /**
   * A repository for a ValidationHandler to resolve its schemas against. Draft 2020-12 is the
   * current default; the base URI is required and is never dereferenced here.
   */
  public static SchemaRepository repository() {
    return SchemaRepository.create(
        new JsonSchemaOptions().setDraft(Draft.DRAFT202012).setBaseUri("https://rb.invalid"));
  }

  /** The order, from the body the handler already validated. */
  // rb:wiring body.*,domain.*
  public static ValidatedOrder order(JsonObject body) {
    JsonArray rows = body.getJsonArray("lines");
    List<LineInput> in = new ArrayList<>(rows.size());
    for (int i = 0; i < rows.size(); i++) {
      JsonObject row = rows.getJsonObject(i);
      in.add(new LineInput(row.getInteger("product_id"), row.getInteger("qty")));
    }
    return Domain.priceOrder(body.getInteger("customer_id"), body.getString("status"), in);
  }

  /**
   * Why the handler refused the body, in its own words.
   *
   * BodyProcessorException carries the parameter it was validating and the schema failure
   * underneath it. Vert.x reports one: the handler fails the context on the first thing that
   * did not fit, so there is no collect-all mode to ask for.
   */
  // rb:wiring body.*,errors.*
  public static JsonObject refusedBody(Throwable t) {
    String detail = t.getMessage() == null ? "body did not match the schema" : t.getMessage();
    return new JsonObject()
        .put("error", "validation_failed")
        .put("detail", detail);
  }

  /**
   * Every failure a ValidationHandler raises extends BadRequestException, whether it was the
   * body, a query parameter or a predicate that did not fit, and 400 is the status Vert.x
   * gives all three.
   */
  public static boolean isRefusal(Throwable t) {
    return t instanceof BadRequestException;
  }
}
