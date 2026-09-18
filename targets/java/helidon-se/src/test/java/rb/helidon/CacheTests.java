package rb.helidon;

import io.helidon.webclient.http1.Http1Client;
import org.junit.jupiter.api.Test;

/**
 * cache: the framework's own response cache, and what it is keyed on.
 *
 * <p>The vary rows are the ones worth having. A store keyed on fewer headers than it declares
 * answers one tenant with another tenant's body, and that is a correctness failure a latency
 * chart renders as a target that got faster.
 */
class CacheTests extends HelidonSuite {

  CacheTests(Http1Client client) {
    super(client);
  }

  // rb:test cache.small
  @Test
  void the_small_cached_response_is_what_the_spec_pins() {
    Planned.Ask a = Planned.ask("cache.small");

    Floor.Answer answer = send(a);

    Floor.check(a, answer);
  }

  // rb:test cache.medium
  @Test
  void the_medium_one_is_too() {
    Planned.Ask a = Planned.ask("cache.medium");

    Floor.Answer answer = send(a);

    Floor.check(a, answer);
  }

  // rb:test cache.large
  @Test
  void and_the_large_one() {
    Planned.Ask a = Planned.ask("cache.large");

    Floor.Answer answer = send(a);

    Floor.check(a, answer);
  }

  // rb:test cache.vary_one
  @Test
  void a_response_varying_on_one_header_says_so() {
    Planned.Ask a = Planned.ask("cache.vary_one");

    Floor.Answer answer = send(a);

    Floor.check(a, answer);
  }

  // rb:test cache.vary_many
  @Test
  void and_one_varying_on_three_says_all_three() {
    Planned.Ask a = Planned.ask("cache.vary_many");

    Floor.Answer answer = send(a);

    Floor.check(a, answer);
  }
}
