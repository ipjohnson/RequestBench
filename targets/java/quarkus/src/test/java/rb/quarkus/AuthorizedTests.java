package rb.quarkus;

import io.quarkus.test.junit.QuarkusTest;
import org.junit.jupiter.api.Test;

/**
 * authorized: one endpoint that refuses, and one that does not.
 *
 * <p>The pair is the test. A target that let everything through would pass the allowed case and
 * nothing else, so the denial is what carries the family, and its envelope is the
 * framework's own rather than this repository's.
 */
@QuarkusTest
class AuthorizedTests extends QuarkusSuite {

  // rb:test authorized.allowed
  @Test
  void a_request_carrying_the_token_is_served() throws Exception {
    Planned.Ask a = Planned.ask("authorized.allowed");

    Floor.Answer answer = send(a);

    Floor.check(a, answer);
  }

  // rb:test authorized.denied
  @Test
  void a_request_with_the_wrong_token_is_refused_in_the_frameworks_own_shape() throws Exception {
    Planned.Ask a = Planned.ask("authorized.denied");

    Floor.Answer answer = send(a);

    Envelope.check(a, answer, TARGET);
  }
}
