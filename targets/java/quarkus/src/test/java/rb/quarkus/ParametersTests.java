package rb.quarkus;

import io.quarkus.test.junit.QuarkusTest;
import org.junit.jupiter.api.Test;

/**
 * parameters: route capture, at zero, one and two segments.
 *
 * <p>The captured values do not reach the answer. The payload is the shared one, so what these
 * hold is that the route matched at all: a target whose two-segment pattern is wrong answers
 * 404 and the floor says so on the status line before it ever looks at a body.
 */
@QuarkusTest
class ParametersTests extends QuarkusSuite {

  // rb:test parameters.static
  @Test
  void a_route_with_nothing_to_capture_matches() throws Exception {
    Planned.Ask a = Planned.ask("parameters.static");

    Floor.Answer answer = send(a);

    Floor.check(a, answer);
  }

  // rb:test parameters.one
  @Test
  void one_captured_segment_matches() throws Exception {
    Planned.Ask a = Planned.ask("parameters.one");

    Floor.Answer answer = send(a);

    Floor.check(a, answer);
  }

  // rb:test parameters.two
  @Test
  void two_captured_segments_match() throws Exception {
    Planned.Ask a = Planned.ask("parameters.two");

    Floor.Answer answer = send(a);

    Floor.check(a, answer);
  }
}
