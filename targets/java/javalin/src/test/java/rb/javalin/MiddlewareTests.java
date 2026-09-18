package rb.javalin;

import io.javalin.testtools.JavalinTest;
import org.junit.jupiter.api.Test;

/**
 * middleware: per-layer dispatch cost at 0, 4 and 16 no-op layers.
 *
 * <p>The layers are no-ops, so nothing they do is visible in a response and no assertion over
 * one can tell four apart from sixteen. What a test can hold is the thing that goes wrong in
 * practice: a test that calls the handler rather than the app passes while the layers never
 * ran at all. The test host boots the application, so the layers are in the path here by
 * construction, and that is the whole of what these three assert.
 */
class MiddlewareTests extends JavalinSuite {

  // rb:test middleware.none
  @Test
  void the_unlayered_route_answers_the_shared_payload() throws Exception {
    JavalinTest.test(app(), (server, client) -> {
      Planned.Ask a = Planned.ask("middleware.none");

      Floor.Answer answer = send(client, a);

      Floor.check(a, answer);
    });
  }

  // rb:test middleware.four
  @Test
  void four_layers_do_not_change_the_answer() throws Exception {
    JavalinTest.test(app(), (server, client) -> {
      Planned.Ask a = Planned.ask("middleware.four");

      Floor.Answer answer = send(client, a);

      Floor.check(a, answer);
    });
  }

  // rb:test middleware.sixteen
  @Test
  void sixteen_layers_do_not_change_it_either() throws Exception {
    JavalinTest.test(app(), (server, client) -> {
      Planned.Ask a = Planned.ask("middleware.sixteen");

      Floor.Answer answer = send(client, a);

      Floor.check(a, answer);
    });
  }
}
