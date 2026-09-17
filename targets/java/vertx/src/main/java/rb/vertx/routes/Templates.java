package rb.vertx.routes;

import com.github.jknack.handlebars.context.FieldValueResolver;
import com.github.jknack.handlebars.context.JavaBeanValueResolver;
import com.github.jknack.handlebars.context.MapValueResolver;
import com.github.jknack.handlebars.context.MethodValueResolver;
import io.vertx.core.Vertx;
import io.vertx.core.json.JsonObject;
import io.vertx.ext.web.Router;
import io.vertx.ext.web.templ.handlebars.HandlebarsTemplateEngine;
import java.util.Map;
import rb.domain.Domain;
import rb.domain.Model.PayloadBody;

/**
 * template: server-side rendering of the same model the json family serializes.
 *
 * Vert.x Web's own view facility: a TemplateEngine, reached by naming a template file.
 * Handlebars is the engine Vert.x Web's Templates section lists first, through
 * vertx-web-templ-handlebars. Compiled on first render and cached by the engine: a
 * precomputed string would measure nothing.
 *
 * MethodValueResolver is added because the model carries records, and handlebars-java's
 * default bean resolver reads getId() rather than id().
 */
public final class Templates {
  private Templates() {}

  private static JsonObject model(String size) {
    PayloadBody body = Domain.payload(size);
    return new JsonObject(Map.of("size", body.size(),
                                 "count", body.count(),
                                 "items", body.items()));
  }

  private static void render(Router router, HandlebarsTemplateEngine engine, String path,
                             String size) {
    JsonObject data = model(size);
    router.get(path).handler(ctx -> engine.render(data, "templates/items.hbs")
        .onSuccess(buf -> ctx.response().putHeader("content-type", "text/html").end(buf))
        .onFailure(ctx::fail));
  }

  public static void register(Vertx vertx, Router router) {
    HandlebarsTemplateEngine engine = HandlebarsTemplateEngine.create(vertx);
    engine.setResolvers(MapValueResolver.INSTANCE, MethodValueResolver.INSTANCE,
                        JavaBeanValueResolver.INSTANCE, FieldValueResolver.INSTANCE);

    render(router, engine, "/template/small", "small");

    render(router, engine, "/template/medium", "medium");
  }
}
