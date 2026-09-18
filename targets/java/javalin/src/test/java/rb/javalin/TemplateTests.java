package rb.javalin;

import static org.junit.jupiter.api.Assertions.assertTrue;

import io.javalin.testtools.JavalinTest;
import org.junit.jupiter.api.Test;

/**
 * template: server-side HTML, at two sizes.
 *
 * <p>The one family whose body is not compared byte for byte. Five template engines cannot
 * agree on formatting without every template being contorted to match, so the spec pins the
 * content and leaves the whitespace free: same elements, same order, same values. The floor
 * normalises both sides the way the conformance client does.
 */
class TemplateTests extends JavalinSuite {

  // rb:test template.small
  @Test
  void the_small_template_renders_the_pinned_content() throws Exception {
    JavalinTest.test(app(), (server, client) -> {
      Planned.Ask a = Planned.ask("template.small");

      Floor.Answer answer = send(client, a);

      Floor.check(a, answer);
      assertTrue(answer.contentType().startsWith("text/html"));
    });
  }

  // rb:test template.medium
  @Test
  void the_medium_template_does_too() throws Exception {
    JavalinTest.test(app(), (server, client) -> {
      Planned.Ask a = Planned.ask("template.medium");

      Floor.Answer answer = send(client, a);

      Floor.check(a, answer);
    });
  }
}
