package rb.helidon;

import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import io.helidon.webclient.http1.Http1Client;
import org.junit.jupiter.api.Test;

/**
 * etag: the validator a target computes, and what it does when one comes back.
 *
 * <p>The 304 is the interesting one: it is the only request in the corpus that cannot be sent until
 * the target has answered a different one, because the validator is the target's to produce.
 */
class EtagTests extends HelidonSuite {

  EtagTests(Http1Client client) {
    super(client);
  }

  // rb:test etag.small
  @Test
  void the_small_response_carries_a_validator() {
    Planned.Ask a = Planned.ask("etag.small");

    Floor.Answer answer = send(a);

    Floor.check(a, answer);
    assertNotNull(answer.headers().get("etag"));
  }

  // rb:test etag.large
  @Test
  void so_does_the_large_one() {
    Planned.Ask a = Planned.ask("etag.large");

    Floor.Answer answer = send(a);

    Floor.check(a, answer);
    assertNotNull(answer.headers().get("etag"));
  }

  // rb:test etag.match_large
  @Test
  void a_validator_the_target_just_issued_is_answered_with_304() {
    Planned.Ask a = Planned.ask("etag.match_large");

    Floor.Answer answer = sendAfterCapture(a);

    Floor.check(a, answer);
    assertTrue(answer.contentType().isEmpty());
  }

  // rb:test etag.stale_large
  @Test
  void a_validator_the_target_never_issued_is_answered_in_full() {
    Planned.Ask a = Planned.ask("etag.stale_large");

    Floor.Answer answer = send(a);

    Floor.check(a, answer);
    assertNotNull(answer.headers().get("etag"));
  }
}
