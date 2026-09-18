package rb.vertx;

import static org.junit.jupiter.api.Assertions.assertEquals;

import org.junit.jupiter.api.Test;

/**
 * domain: the eight operations that reach the shared model, including the four that write.
 *
 * <p>The largest family and the one where a handler is doing something rather than returning
 * something. The writes are the ones a test earns its keep on: a 201 with no body and a 204
 * with no body are both answers a framework can get subtly wrong while returning the right
 * status, which is why the floor checks the kind of body even when there is none.
 */
class DomainTests extends VertxSuite {

  // rb:test domain.lookup
  @Test
  void one_order_is_looked_up() throws Exception {
    Planned.Ask a = Planned.ask("domain.lookup");

    Floor.Answer answer = send(a);

    Floor.check(a, answer);
  }

  // rb:test domain.filter
  @Test
  void a_filtered_list_comes_back() throws Exception {
    Planned.Ask a = Planned.ask("domain.filter");

    Floor.Answer answer = send(a);

    Floor.check(a, answer);
  }

  // rb:test domain.join
  @Test
  void a_join_across_the_model_comes_back() throws Exception {
    Planned.Ask a = Planned.ask("domain.join");

    Floor.Answer answer = send(a);

    Floor.check(a, answer);
  }

  // rb:test domain.aggregate
  @Test
  void an_aggregate_is_computed() throws Exception {
    Planned.Ask a = Planned.ask("domain.aggregate");

    Floor.Answer answer = send(a);

    Floor.check(a, answer);
  }

  // rb:test domain.create
  @Test
  void a_created_order_answers_201() throws Exception {
    Planned.Ask a = Planned.ask("domain.create");

    Floor.Answer answer = send(a);

    Floor.check(a, answer);
  }

  // rb:test domain.replace
  @Test
  void a_replaced_customer_answers_the_new_state() throws Exception {
    Planned.Ask a = Planned.ask("domain.replace");

    Floor.Answer answer = send(a);

    Floor.check(a, answer);
  }

  // rb:test domain.patch
  @Test
  void a_patched_customer_answers_the_merged_state() throws Exception {
    Planned.Ask a = Planned.ask("domain.patch");

    Floor.Answer answer = send(a);

    Floor.check(a, answer);
  }

  // rb:test domain.delete
  @Test
  void a_deleted_line_answers_204_and_no_body() throws Exception {
    Planned.Ask a = Planned.ask("domain.delete");

    Floor.Answer answer = send(a);

    Floor.check(a, answer);
    assertEquals(0, answer.raw().length);
  }
}
