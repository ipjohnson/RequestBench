package rb.helidon;

import static org.junit.jupiter.api.Assertions.assertTrue;

import io.helidon.webclient.http1.Http1Client;
import org.junit.jupiter.api.Test;

/**
 * baseline: the dispatch floor, with no serialization in the way.
 *
 * <p>The one endpoint in the corpus that answers a literal. Its whole contract is the string
 * and the content type, and the content type is the half a test gets wrong: a target that
 * answers "Hello, World!" as application/json has passed the body and failed the endpoint.
 * The floor checks the kind of body before the body for that reason.
 */
class BaselineTests extends HelidonSuite {

  BaselineTests(Http1Client client) {
    super(client);
  }

  // rb:test baseline.plaintext
  @Test
  void the_plaintext_route_answers_a_literal_as_text() {
    Planned.Ask a = Planned.ask("baseline.plaintext");

    Floor.Answer answer = send(a);

    Floor.check(a, answer);
    assertTrue(answer.contentType().startsWith("text/plain"));
  }
}
