package rb.micronaut;

import io.micronaut.test.extensions.junit5.annotation.MicronautTest;
import org.junit.jupiter.api.Test;

/**
 * body: binding and validating a request body, at two sizes and two refusals.
 *
 * <p>Where the six Java targets stop agreeing. Each reaches a different validation facility, and
 * the two refusals are judged as envelopes because what a framework answers when a body is wrong
 * is its own contract, not this repository's.
 */
@MicronautTest
class BodyTests extends MicronautSuite {

  // rb:test body.bind_small
  @Test
  void a_small_body_binds() throws Exception {
    Planned.Ask a = Planned.ask("body.bind_small");

    Floor.Answer answer = send(a);

    Floor.check(a, answer);
  }

  // rb:test body.bind_medium
  @Test
  void a_medium_body_binds() throws Exception {
    Planned.Ask a = Planned.ask("body.bind_medium");

    Floor.Answer answer = send(a);

    Floor.check(a, answer);
  }

  // rb:test body.validate_small
  @Test
  void a_small_body_that_is_valid_passes_validation() throws Exception {
    Planned.Ask a = Planned.ask("body.validate_small");

    Floor.Answer answer = send(a);

    Floor.check(a, answer);
  }

  // rb:test body.validate_medium
  @Test
  void a_medium_body_that_is_valid_does_too() throws Exception {
    Planned.Ask a = Planned.ask("body.validate_medium");

    Floor.Answer answer = send(a);

    Floor.check(a, answer);
  }

  // rb:test body.rejected_all
  @Test
  void a_body_failing_three_rules_is_refused() throws Exception {
    Planned.Ask a = Planned.ask("body.rejected_all");

    Floor.Answer answer = send(a);

    Envelope.check(a, answer, TARGET);
  }

  // rb:test body.rejected_first
  @Test
  void a_body_failing_one_rule_is_refused_the_same_way() throws Exception {
    Planned.Ask a = Planned.ask("body.rejected_first");

    Floor.Answer answer = send(a);

    Envelope.check(a, answer, TARGET);
  }
}
