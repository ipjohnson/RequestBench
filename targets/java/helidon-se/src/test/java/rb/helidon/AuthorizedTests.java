package rb.helidon;

import io.helidon.webclient.http1.Http1Client;
import org.junit.jupiter.api.Test;

/**
 * authorized: one endpoint that refuses, and one that does not.
 *
 * <p>The pair is the test. A target that let everything through would pass the allowed case and
 * nothing else, so the denial is what carries the family, and its envelope is the
 * framework's own rather than this repository's.
 */
class AuthorizedTests extends HelidonSuite {

  AuthorizedTests(Http1Client client) {
    super(client);
  }

  // rb:test authorized.allowed
  @Test
  void a_request_carrying_the_token_is_served() {
    Planned.Ask a = Planned.ask("authorized.allowed");

    Floor.Answer answer = send(a);

    Floor.check(a, answer);
  }

  // rb:test authorized.denied
  @Test
  void a_request_with_the_wrong_token_is_refused_in_the_frameworks_own_shape() {
    Planned.Ask a = Planned.ask("authorized.denied");

    Floor.Answer answer = send(a);

    Envelope.check(a, answer, TARGET);
  }
}
