package rb.micronaut;

import io.micronaut.test.extensions.junit5.annotation.MicronautTest;
import org.junit.jupiter.api.Test;

/**
 * headers: request headers at a few and at many, left unread and then bound.
 *
 * <p>/headers reads none, so its body is fixed and what a response can hold is that the
 * request was accepted with all of them attached. /headers/bind echoes the three it bound. The
 * plan reader fills the pinned echo with the values it drew, so the floor check holds that each
 * came back converted: two strings, and x-rb-account as a number.
 */
@MicronautTest
class HeadersTests extends MicronautSuite {

  // rb:test headers.few
  @Test
  void a_request_carrying_a_few_headers_is_served() throws Exception {
    Planned.Ask a = Planned.ask("headers.few");

    Floor.Answer answer = send(a);

    Floor.check(a, answer);
  }

  // rb:test headers.many
  @Test
  void and_one_carrying_many_is_served_the_same_way() throws Exception {
    Planned.Ask a = Planned.ask("headers.many");

    Floor.Answer answer = send(a);

    Floor.check(a, answer);
  }

  // rb:test headers.bind_few
  @Test
  void three_bound_headers_come_back_in_the_echo() throws Exception {
    Planned.Ask a = Planned.ask("headers.bind_few");

    Floor.Answer answer = send(a);

    Floor.check(a, answer);
  }

  // rb:test headers.bind_many
  @Test
  void and_come_back_the_same_among_thirty() throws Exception {
    Planned.Ask a = Planned.ask("headers.bind_many");

    Floor.Answer answer = send(a);

    Floor.check(a, answer);
  }
}
