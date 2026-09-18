package rb.javalin;

import static org.junit.jupiter.api.Assertions.assertEquals;

import io.javalin.testtools.JavalinTest;
import org.junit.jupiter.api.Test;

/**
 * compressed: outbound gzip, the cost of the wiring declining and the cost of it working.
 *
 * <p>The family a test client can quietly fail to reach. Where a target compresses inside the
 * application an in-process client still runs the codec; where the compression belongs to the
 * server underneath, no in-process client reaches it and the only honest test is one over a real port.
 *
 * <p>The second trap is the client. Some of the clients here decode gzip before the body is
 * read, so a test reading the decoded body would pass every assertion below against an identity
 * response. The suite's own send says whether this one does.
 */
class CompressedTests extends JavalinSuite {

  // rb:test compressed.identity_small
  @Test
  void a_client_that_will_not_take_gzip_is_answered_in_full() throws Exception {
    JavalinTest.test(app(), (server, client) -> {
      Planned.Ask a = Planned.ask("compressed.identity_small");

      Floor.Answer answer = send(client, a);

      Floor.check(a, answer);
      assertEquals("", answer.encoding());
    });
  }

  // rb:test compressed.identity_large
  @Test
  void the_large_payload_is_uncompressed_too_when_identity_was_asked_for() throws Exception {
    JavalinTest.test(app(), (server, client) -> {
      Planned.Ask a = Planned.ask("compressed.identity_large");

      Floor.Answer answer = send(client, a);

      Floor.check(a, answer);
      assertEquals("", answer.encoding());
    });
  }

  // rb:test compressed.gzip_small
  @Test
  void a_payload_under_the_shared_floor_is_sent_uncompressed_even_so() throws Exception {
    JavalinTest.test(app(), (server, client) -> {
      Planned.Ask a = Planned.ask("compressed.gzip_small");

      Floor.Answer answer = send(client, a);

      Floor.check(a, answer);
      // spec/expected.json pins no encoding here, because the frameworks disagree about a body
      // this small. Javalin skips a body under its compression strategy's 1,500-byte minimum.
      assertEquals("", answer.encoding());
    });
  }

  // rb:test compressed.gzip_large
  @Test
  void a_payload_over_the_floor_is_gzipped() throws Exception {
    JavalinTest.test(app(), (server, client) -> {
      Planned.Ask a = Planned.ask("compressed.gzip_large");

      Floor.Answer answer = send(client, a);

      Floor.check(a, answer);
      assertEquals("gzip", answer.encoding());
      // Javalin's compression sends no Vary: Accept-Encoding, so this does not ask for one.
    });
  }
}
