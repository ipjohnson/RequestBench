"""domain: the eight operations that reach the shared model, including the four that write.

The largest family and the one where a handler is doing something rather than returning
something. The writes are the ones a test earns its keep on: a 201 with no body and a 204
with no body are both answers a framework can get subtly wrong while returning the right
status, which is why the floor checks the kind of body even when there is none.
"""
from django.test import SimpleTestCase

import floor
import planned
from support import send


class DomainTests(SimpleTestCase):

    # rb:test domain.lookup
    async def test_one_order_is_looked_up(self):
        a = planned.ask("domain.lookup")

        answer = await send(self.async_client, a)

        floor.check(a, answer)

    # rb:test domain.filter
    async def test_a_filtered_list_comes_back(self):
        a = planned.ask("domain.filter")

        answer = await send(self.async_client, a)

        floor.check(a, answer)

    # rb:test domain.join
    async def test_a_join_across_the_model_comes_back(self):
        a = planned.ask("domain.join")

        answer = await send(self.async_client, a)

        floor.check(a, answer)

    # rb:test domain.aggregate
    async def test_an_aggregate_is_computed(self):
        a = planned.ask("domain.aggregate")

        answer = await send(self.async_client, a)

        floor.check(a, answer)

    # rb:test domain.create
    async def test_a_created_order_answers_201(self):
        a = planned.ask("domain.create")

        answer = await send(self.async_client, a)

        floor.check(a, answer)

    # rb:test domain.replace
    async def test_a_replaced_customer_answers_the_new_state(self):
        a = planned.ask("domain.replace")

        answer = await send(self.async_client, a)

        floor.check(a, answer)

    # rb:test domain.patch
    async def test_a_patched_customer_answers_the_merged_state(self):
        a = planned.ask("domain.patch")

        answer = await send(self.async_client, a)

        floor.check(a, answer)

    # rb:test domain.delete
    async def test_a_deleted_line_answers_204_and_no_body(self):
        a = planned.ask("domain.delete")

        answer = await send(self.async_client, a)

        floor.check(a, answer)
        self.assertEqual(answer.raw, b"")
