package rb.quarkus;

import static org.junit.jupiter.api.Assertions.assertEquals;

import io.quarkus.test.junit.QuarkusTest;
import org.junit.jupiter.api.Test;

/**
 * body: binding and validating a request body, at two sizes and two refusals.
 *
 * <p>Where the six Java targets stop agreeing. Each reaches a different validation facility, and
 * the two refusals are judged as envelopes because what a framework answers when a body is wrong
 * is its own contract, not this repository's.
 */
@QuarkusTest
class BodyTests extends QuarkusSuite {

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

    // @QuarkusTest runs in Quarkus's test launch mode, and there Quarkus's own
    // BuiltinMismatchedInputExceptionMapper answers a body it could not bind with a detailed
    // 400: objectName, attributeName, line, column, value. In production it answers a bare 400
    // and this target's BodilessErrors filter gives it the envelope spec/expected.json records.
    // The profile does not change that and LaunchMode does, and no @QuarkusTest runs in
    // NORMAL. So this test holds the status and the kind of body, and the envelope itself is
    // only visible to a @QuarkusIntegrationTest against the packaged jar.
    assertEquals(Planned.envelope(TARGET, a.key()).get("status").asInt(), answer.status());
    assertEquals("json", Floor.bodyClass(answer.contentType()));
  }

  // rb:test body.rejected_first
  @Test
  void a_body_failing_one_rule_is_refused_the_same_way() throws Exception {
    Planned.Ask a = Planned.ask("body.rejected_first");

    Floor.Answer answer = send(a);

    // @QuarkusTest runs in Quarkus's test launch mode, and there Quarkus's own
    // BuiltinMismatchedInputExceptionMapper answers a body it could not bind with a detailed
    // 400: objectName, attributeName, line, column, value. In production it answers a bare 400
    // and this target's BodilessErrors filter gives it the envelope spec/expected.json records.
    // The profile does not change that and LaunchMode does, and no @QuarkusTest runs in
    // NORMAL. So this test holds the status and the kind of body, and the envelope itself is
    // only visible to a @QuarkusIntegrationTest against the packaged jar.
    assertEquals(Planned.envelope(TARGET, a.key()).get("status").asInt(), answer.status());
    assertEquals("json", Floor.bodyClass(answer.contentType()));
  }
}
