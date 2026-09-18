package rb.helidon;

import io.helidon.webclient.http1.Http1Client;
import org.junit.jupiter.api.Test;

/**
 * errors: the three refusals that are nobody's fault but the request's.
 *
 * <p>All three are envelopes rather than pinned bodies. errors.unmatched is the one that tests
 * the framework rather than the handler: nothing registers that path, so what answers is
 * whatever the target does with a route it does not have.
 */
class ErrorsTests extends HelidonSuite {

  ErrorsTests(Http1Client client) {
    super(client);
  }

  // rb:test errors.not_found
  @Test
  void a_registered_route_with_no_such_row_answers_404() {
    Planned.Ask a = Planned.ask("errors.not_found");

    Floor.Answer answer = send(a);

    Envelope.check(a, answer, TARGET);
  }

  // rb:test errors.unmatched
  @Test
  void a_path_nothing_registers_answers_the_frameworks_own_404() {
    Planned.Ask a = Planned.ask("errors.unmatched");

    Floor.Answer answer = send(a);

    Envelope.check(a, answer, TARGET);
  }

  // rb:test errors.malformed
  @Test
  void a_body_that_is_not_json_at_all_is_refused() {
    Planned.Ask a = Planned.ask("errors.malformed");

    Floor.Answer answer = send(a);

    Envelope.check(a, answer, TARGET);
  }
}
