package rb.helidon;

import io.helidon.webclient.http1.Http1Client;
import org.junit.jupiter.api.Test;

/**
 * json: serialization cost at three sizes, and nothing else in the path.
 *
 * <p>The three differ only in how much there is to serialize, so there is nothing here a test
 * can say that the floor does not already say better: the pinned body is the whole contract.
 * What the three tests are for is the ratchet. An endpoint with no test is counted, and
 * three that pass at three sizes is how a serializer that truncates the large one is caught.
 */
class JsonTests extends HelidonSuite {

  JsonTests(Http1Client client) {
    super(client);
  }

  // rb:test json.small
  @Test
  void the_small_payload_serializes_to_what_the_spec_pins() {
    Planned.Ask a = Planned.ask("json.small");

    Floor.Answer answer = send(a);

    Floor.check(a, answer);
  }

  // rb:test json.medium
  @Test
  void the_medium_payload_does_too() {
    Planned.Ask a = Planned.ask("json.medium");

    Floor.Answer answer = send(a);

    Floor.check(a, answer);
  }

  // rb:test json.large
  @Test
  void and_the_large_one_which_is_where_a_truncation_would_show() {
    Planned.Ask a = Planned.ask("json.large");

    Floor.Answer answer = send(a);

    Floor.check(a, answer);
  }
}
