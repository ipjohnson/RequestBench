"""query: parsing and coercing query parameters, at one and at eight.

The values never reach the answer, which is the point: this family is the parse and the
coercion isolated from any use of them. A target that silently drops a parameter it cannot
coerce answers the same body as one that read all eight, so what these hold is the status.
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
