package rb.helidon.routes;

import io.helidon.webserver.http.HttpRouting;
import java.util.Map;
import org.thymeleaf.TemplateEngine;
import org.thymeleaf.context.Context;
import org.thymeleaf.templatemode.TemplateMode;
import org.thymeleaf.templateresolver.ClassLoaderTemplateResolver;
import rb.domain.Domain;
import rb.domain.Model.PayloadBody;

/**
 * template: server-side rendering of the same model the json family serializes.
 *
 * Helidon SE ships no view layer and recommends no engine, so this target holds its own
 * engine and renders in the handler. Thymeleaf is the most used server-side template
 * engine in Java, which is where a framework with no opinion leaves the choice; it is also
 * what spring-boot and micronaut reach through their own view layers, so the Java rows
 * that differ differ because the framework does.
 *
 * The expressions call the record accessors rather than reading properties, because
 * Thymeleaf outside Spring evaluates with OGNL, which resolves getId() and not id().
 */
public final class Templates {
  private Templates() {}

  // Parsed on first render and cached by the resolver, rendered per request. A precomputed
  // string would measure nothing.
  private static final TemplateEngine ENGINE = engine();

  private static TemplateEngine engine() {
    ClassLoaderTemplateResolver resolver = new ClassLoaderTemplateResolver();
    resolver.setPrefix("templates/");
    resolver.setSuffix(".html");
    resolver.setTemplateMode(TemplateMode.HTML);
    resolver.setCacheable(true);
    TemplateEngine e = new TemplateEngine();
    e.setTemplateResolver(resolver);
    return e;
  }

  private static String render(String size) {
    PayloadBody body = Domain.payload(size);
    Context ctx = new Context();
    ctx.setVariables(Map.of("size", body.size(),
                            "count", body.count(),
                            "items", body.items()));
    return ENGINE.process("items", ctx);
  }

  public static void register(HttpRouting.Builder r) {
    r.get("/template/small", (req, res) -> res.header("content-type", "text/html")
        .send(render("small")));

    r.get("/template/medium", (req, res) -> res.header("content-type", "text/html")
        .send(render("medium")));
  }
}
