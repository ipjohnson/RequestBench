"""authorized: one endpoint that refuses, and one that does not.

The pair is the test. A target that let everything through would pass the allowed case and
nothing else, so the denial is what carries the family, and its envelope is the
framework's own rather than this repository's.
"""
from django.test import SimpleTestCase

import envelope
import floor
import planned
from support import send

TARGET = "python:django-asgi"


class AuthorizedTests(SimpleTestCase):

    # rb:test authorized.allowed
    async def test_a_request_carrying_the_token_is_served(self):
        a = planned.ask("authorized.allowed")

        answer = await send(self.async_client, a)

        floor.check(a, answer)

    # rb:test authorized.denied
    async def test_a_request_with_the_wrong_token_is_refused_in_the_frameworks_own_shape(self):
        a = planned.ask("authorized.denied")

        answer = await send(self.async_client, a)

        envelope.check(a, answer, TARGET)
