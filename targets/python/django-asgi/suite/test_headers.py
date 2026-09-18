"""headers: reading request headers, at a few and at many.

The header count is the variable and the body is fixed, so a target that stopped reading
headers at some limit would answer this correctly and still be wrong. What a response can
hold is that the request was accepted with all of them attached, which is what these do.
"""
from django.test import SimpleTestCase

import floor
import planned
from support import send


class HeadersTests(SimpleTestCase):

    # rb:test headers.few
    async def test_a_request_carrying_a_few_headers_is_served(self):
        a = planned.ask("headers.few")

        answer = await send(self.async_client, a)

        floor.check(a, answer)

    # rb:test headers.many
    async def test_and_one_carrying_many_is_served_the_same_way(self):
        a = planned.ask("headers.many")

        answer = await send(self.async_client, a)

        floor.check(a, answer)
