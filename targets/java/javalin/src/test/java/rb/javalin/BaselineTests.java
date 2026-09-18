package rb.javalin;

import static org.junit.jupiter.api.Assertions.assertTrue;

import io.javalin.testtools.JavalinTest;
import org.junit.jupiter.api.Test;

/**
 * baseline: the dispatch floor, with no serialization in the way.
 *
 * <p>The one endpoint in the corpus that answers a literal. Its whole contract is the string
 * and the content type, and the content type is the half a test gets wrong: a target that
 * answers "Hello, World!" as application/json has passed the body and failed the endpoint.
 * The floor checks the kind of body before the body for that reason.
 */
class BaselineTests extends JavalinSuite {

  // rb:test baseline.plaintext
  @Test
  void the_plaintext_route_answers_a_literal_as_text() throws Exception {
    JavalinTest.test(app(), (server, client) -> {
      Planned.Ask a = Planned.ask("baseline.plaintext");

      Floor.Answer answer = send(client, a);

      Floor.check(a, answer);
      assertTrue(answer.contentType().startsWith("text/plain"));
    });
  }
}
