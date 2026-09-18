"""parameters: route capture at a depth of four segments, with none, one and two captured.

Each capture is bound as an integer and echoed beside the small payload. The plan reader
fills the pinned body with the values it sent, so the floor check is the echo check. A target
whose pattern is wrong answers 404 and the floor says so on the status line. One that bound
the wrong segment, or answered a capture as a string, fails on the body. The static route
overlaps the one-capture route, so its test also holds that the literal wins.
"""
from django.test import SimpleTestCase

import floor
import planned
from support import send


class ParametersTests(SimpleTestCase):

    # rb:test parameters.static
    async def test_the_static_route_wins_over_the_capture_it_overlaps(self):
        a = planned.ask("parameters.static")

        answer = await send(self.async_client, a)

        floor.check(a, answer)

    # rb:test parameters.one
    async def test_one_captured_segment_is_bound_as_an_integer_and_echoed(self):
        a = planned.ask("parameters.one")

        answer = await send(self.async_client, a)

        floor.check(a, answer)

    # rb:test parameters.two
    async def test_and_two_are_bound_and_echoed_the_same_way(self):
        a = planned.ask("parameters.two")

        answer = await send(self.async_client, a)

        floor.check(a, answer)
