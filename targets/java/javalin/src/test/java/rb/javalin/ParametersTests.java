package rb.javalin;

import io.javalin.testtools.JavalinTest;
import org.junit.jupiter.api.Test;

/**
 * parameters: route capture, at zero, one and two segments.
 *
 * <p>Each captured segment is bound as an integer and echoed. The plan reader fills the pinned
 * echo with the values it drew, so the floor check holds that each came back as the number
 * sent. The static test holds that the literal route still wins over {one}/segment/literal,
 * which would answer "static" with an echo or a refusal rather than the plain payload.
 */
class ParametersTests extends JavalinSuite {

  // rb:test parameters.static
  @Test
  void a_route_with_nothing_to_capture_matches() throws Exception {
    JavalinTest.test(app(), (server, client) -> {
      Planned.Ask a = Planned.ask("parameters.static");

      Floor.Answer answer = send(client, a);

      Floor.check(a, answer);
    });
  }

  // rb:test parameters.one
  @Test
  void one_captured_segment_is_bound_and_echoed() throws Exception {
    JavalinTest.test(app(), (server, client) -> {
      Planned.Ask a = Planned.ask("parameters.one");

      Floor.Answer answer = send(client, a);

      Floor.check(a, answer);
    });
  }

  // rb:test parameters.two
  @Test
  void two_captured_segments_are_bound_and_echoed() throws Exception {
    JavalinTest.test(app(), (server, client) -> {
      Planned.Ask a = Planned.ask("parameters.two");

      Floor.Answer answer = send(client, a);

      Floor.check(a, answer);
    });
  }
}
