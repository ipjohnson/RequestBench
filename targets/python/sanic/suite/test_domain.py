"""domain: the eight operations that reach the shared model, including the four that write.

The largest family and the one where a handler is doing something rather than returning
something. The writes are the ones a test earns its keep on: a 201 with no body and a 204
with no body are both answers a framework can get subtly wrong while returning the right
status, which is why the floor checks the kind of body even when there is none.
"""

import floor
import planned



# rb:test domain.lookup
def test_one_order_is_looked_up(send):
    a = planned.ask("domain.lookup")

    answer = send(a)

    floor.check(a, answer)


# rb:test domain.filter
def test_a_filtered_list_comes_back(send):
    a = planned.ask("domain.filter")

    answer = send(a)

    floor.check(a, answer)


# rb:test domain.join
def test_a_join_across_the_model_comes_back(send):
    a = planned.ask("domain.join")

    answer = send(a)

    floor.check(a, answer)


# rb:test domain.aggregate
def test_an_aggregate_is_computed(send):
    a = planned.ask("domain.aggregate")

    answer = send(a)

    floor.check(a, answer)


# rb:test domain.create
def test_a_created_order_answers_201(send):
    a = planned.ask("domain.create")

    answer = send(a)

    floor.check(a, answer)


# rb:test domain.replace
def test_a_replaced_customer_answers_the_new_state(send):
    a = planned.ask("domain.replace")

    answer = send(a)

    floor.check(a, answer)


# rb:test domain.patch
def test_a_patched_customer_answers_the_merged_state(send):
    a = planned.ask("domain.patch")

    answer = send(a)

    floor.check(a, answer)


# rb:test domain.delete
def test_a_deleted_line_answers_204_and_no_body(send):
    a = planned.ask("domain.delete")

    answer = send(a)

    floor.check(a, answer)
    assert answer.body == b""
