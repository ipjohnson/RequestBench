package rb.javalin;

import io.javalin.testtools.JavalinTest;
import org.junit.jupiter.api.Test;

/**
 * headers: reading request headers, at a few and at many.
 *
 * <p>The header count is the variable and the body is fixed, so a target that stopped reading
 * headers at some limit would answer this correctly and still be wrong. What a response can
 * hold is that the request was accepted with all of them attached, which is what these do.
 */
class HeadersTests extends JavalinSuite {

  // rb:test headers.few
  @Test
  void a_request_carrying_a_few_headers_is_served() throws Exception {
    JavalinTest.test(app(), (server, client) -> {
      Planned.Ask a = Planned.ask("headers.few");

      Floor.Answer answer = send(client, a);

      Floor.check(a, answer);
    });
  }

  // rb:test headers.many
  @Test
  void and_one_carrying_many_is_served_the_same_way() throws Exception {
    JavalinTest.test(app(), (server, client) -> {
      Planned.Ask a = Planned.ask("headers.many");

      Floor.Answer answer = send(client, a);

      Floor.check(a, answer);
    });
  }
}
