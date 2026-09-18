package rb.spring;

import org.junit.jupiter.api.Test;

/**
 * query: parsing, percent-decoding and coercing query parameters, at one and at eight.
 *
 * <p>The answer echoes each value beside the small payload. Planned fills the pinned body with
 * the values it drew for the path, so the floor check is an echo check. A target that drops a
 * parameter answers a different body.
 *
 * <p>MockMvc's request builder decodes the %20 in q before the controller sees it, so these
 * tests do not show that Tomcat decodes it.
 */
class QueryTests extends SpringSuite {

  // rb:test query.one
  @Test
  void one_query_parameter_is_read() throws Exception {
    Planned.Ask a = Planned.ask("query.one");

    Floor.Answer answer = send(a);

    Floor.check(a, answer);
  }

  // rb:test query.many
  @Test
  void eight_of_them_are_read_and_coerced() throws Exception {
    Planned.Ask a = Planned.ask("query.many");

    Floor.Answer answer = send(a);

    Floor.check(a, answer);
  }
}
