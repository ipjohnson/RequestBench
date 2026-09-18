"""query: parsing, percent-decoding and coercing query parameters, at one and at eight.

The answer is the small payload with an echo of every value the target bound. planned.py
draws the values once per process and fills them into the pinned answer, so floor.check
holds each of them as well as the status. A target that drops a parameter, coerces one wrong
or leaves the %20 in q undecoded answers a different echo.
"""
from django.test import SimpleTestCase

import floor
import planned
from support import send


class QueryTests(SimpleTestCase):

    # rb:test query.one
    async def test_one_query_parameter_is_read(self):
        a = planned.ask("query.one")

        answer = await send(self.async_client, a)

        floor.check(a, answer)

    # rb:test query.many
    async def test_eight_of_them_are_read_and_coerced(self):
        a = planned.ask("query.many")

        answer = await send(self.async_client, a)

        floor.check(a, answer)
