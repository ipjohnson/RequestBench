package rb.vertx;

import org.junit.jupiter.api.Test;

/**
 * query: parsing and coercing query parameters, at one and at eight.
 *
 * <p>The values never reach the answer, which is the point: this family is the parse and the
 * coercion isolated from any use of them. A target that silently drops a parameter it cannot
 * coerce answers the same body as one that read all eight, so what these hold is the status.
 */
class QueryTests extends VertxSuite {

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
