package rb.javalin.routes;

import io.javalin.config.JavalinConfig;
import io.javalin.rendering.template.JavalinMustache;
import java.util.Map;
import rb.domain.Domain;
import rb.domain.Model.PayloadBody;

/**
 * template: server-side rendering of the same model the json family serializes.
 *
 * Javalin's own view facility: a FileRenderer registered on the config, reached by
 * ctx.render naming a file. Mustache is the engine javalin.io/plugins/rendering leads
 * with, through javalin-rendering-mustache. Compiled on first render and cached by the
 * plugin: a precomputed string would measure nothing.
 */
public final class Templates {
  private Templates() {}

  private static Map<String, Object> model(String size) {
    PayloadBody body = Domain.payload(size);
    return Map.of("size", body.size(), "count", body.count(), "items", body.items());
  }

  public static void register(JavalinConfig cfg) {
    cfg.fileRenderer(new JavalinMustache());

    cfg.routes.get("/template/small", ctx -> ctx.render("items.mustache", model("small")));

    cfg.routes.get("/template/medium", ctx -> ctx.render("items.mustache", model("medium")));
  }
}
