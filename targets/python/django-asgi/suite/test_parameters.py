"""parameters: route capture, at zero, one and two segments.

The captured values do not reach the answer. The payload is the shared one, so what these
hold is that the route matched at all: a target whose two-segment pattern is wrong answers
404 and the floor says so on the status line before it ever looks at a body.
"""
from django.test import SimpleTestCase

import floor
import planned
from support import send


class ParametersTests(SimpleTestCase):

    # rb:test parameters.static
    async def test_a_route_with_nothing_to_capture_matches(self):
        a = planned.ask("parameters.static")

        answer = await send(self.async_client, a)

        floor.check(a, answer)

    # rb:test parameters.one
    async def test_one_captured_segment_matches(self):
        a = planned.ask("parameters.one")

        answer = await send(self.async_client, a)

        floor.check(a, answer)

    # rb:test parameters.two
    async def test_two_captured_segments_match(self):
        a = planned.ask("parameters.two")

        answer = await send(self.async_client, a)

        floor.check(a, answer)
