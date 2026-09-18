"""middleware: per-layer dispatch cost at 0, 4 and 16 no-op layers.

The layers are no-ops, so nothing they do is visible in a response and no assertion over
one can tell four apart from sixteen. What a test can hold is the thing that goes wrong in
practice: a test that calls the handler rather than the app passes while the layers never
ran at all. The test host boots the application, so the layers are in the path here by
construction, and that is the whole of what these three assert.
"""
from django.test import SimpleTestCase

import floor
import planned
from support import send


class MiddlewareTests(SimpleTestCase):

    # rb:test middleware.none
    async def test_the_unlayered_route_answers_the_shared_payload(self):
        a = planned.ask("middleware.none")

        answer = await send(self.async_client, a)

        floor.check(a, answer)

    # rb:test middleware.four
    async def test_four_layers_do_not_change_the_answer(self):
        a = planned.ask("middleware.four")

        answer = await send(self.async_client, a)

        floor.check(a, answer)

    # rb:test middleware.sixteen
    async def test_sixteen_layers_do_not_change_it_either(self):
        a = planned.ask("middleware.sixteen")

        answer = await send(self.async_client, a)

        floor.check(a, answer)
