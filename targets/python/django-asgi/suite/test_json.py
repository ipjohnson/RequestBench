"""json: serialization cost at three sizes, and nothing else in the path.

The three differ only in how much there is to serialize, so there is nothing here a test
can say that the floor does not already say better: the pinned body is the whole contract.
What the three tests are for is the ratchet. An endpoint with no test is counted, and
three that pass at three sizes is how a serializer that truncates the large one is caught.
"""
from django.test import SimpleTestCase

import floor
import planned
from support import send


class JsonTests(SimpleTestCase):

    # rb:test json.small
    async def test_the_small_payload_serializes_to_what_the_spec_pins(self):
        a = planned.ask("json.small")

        answer = await send(self.async_client, a)

        floor.check(a, answer)

    # rb:test json.medium
    async def test_the_medium_payload_does_too(self):
        a = planned.ask("json.medium")

        answer = await send(self.async_client, a)

        floor.check(a, answer)

    # rb:test json.large
    async def test_and_the_large_one_which_is_where_a_truncation_would_show(self):
        a = planned.ask("json.large")

        answer = await send(self.async_client, a)

        floor.check(a, answer)
