"""body: binding and validating a request body, at two sizes and two refusals.

Where the six Python targets stop agreeing. Each reaches a different validation facility, and
the two refusals are judged as envelopes because what a framework answers when a body is wrong
is its own contract, not this repository's.
"""
from django.test import SimpleTestCase

import envelope
import floor
import planned
from support import send

TARGET = "python:django-asgi"


class BodyTests(SimpleTestCase):

    # rb:test body.bind_small
    async def test_a_small_body_binds(self):
        a = planned.ask("body.bind_small")

        answer = await send(self.async_client, a)

        floor.check(a, answer)

    # rb:test body.bind_medium
    async def test_a_medium_body_binds(self):
        a = planned.ask("body.bind_medium")

        answer = await send(self.async_client, a)

        floor.check(a, answer)

    # rb:test body.validate_small
    async def test_a_small_body_that_is_valid_passes_validation(self):
        a = planned.ask("body.validate_small")

        answer = await send(self.async_client, a)

        floor.check(a, answer)

    # rb:test body.validate_medium
    async def test_a_medium_body_that_is_valid_does_too(self):
        a = planned.ask("body.validate_medium")

        answer = await send(self.async_client, a)

        floor.check(a, answer)

    # rb:test body.rejected_all
    async def test_a_body_failing_three_rules_is_refused(self):
        a = planned.ask("body.rejected_all")

        answer = await send(self.async_client, a)

        envelope.check(a, answer, TARGET)

    # rb:test body.rejected_first
    async def test_a_body_failing_one_rule_is_refused_the_same_way(self):
        a = planned.ask("body.rejected_first")

        answer = await send(self.async_client, a)

        envelope.check(a, answer, TARGET)
