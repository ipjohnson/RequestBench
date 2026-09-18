package rb.helidon;

import io.helidon.webclient.http1.Http1Client;
import org.junit.jupiter.api.Test;

/**
 * query: parsing, percent-decoding and coercing query parameters, at one and at eight.
 *
 * <p>The answer echoes each value beside the small payload. Planned fills the pinned body with
 * the values it drew for the path, so the floor check is an echo check. A target that drops a
 * parameter, or does not decode the %20 in q, answers a different body.
 */
class QueryTests extends HelidonSuite {

  QueryTests(Http1Client client) {
    super(client);
  }

  // rb:test query.one
  @Test
  void one_query_parameter_is_read() {
    Planned.Ask a = Planned.ask("query.one");

    Floor.Answer answer = send(a);

    Floor.check(a, answer);
  }

  // rb:test query.many
  @Test
  void eight_of_them_are_read_and_coerced() {
    Planned.Ask a = Planned.ask("query.many");

    Floor.Answer answer = send(a);

    Floor.check(a, answer);
  }
}
