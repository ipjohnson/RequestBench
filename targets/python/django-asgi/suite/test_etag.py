"""etag: the validator a target computes, and what it does when one comes back.

The 304 is the interesting one: it is the only request in the corpus that cannot be sent until
the target has answered a different one, because the validator is the target's to produce.
"""
from django.test import SimpleTestCase

import floor
import planned
from support import send, send_after_capture


class EtagTests(SimpleTestCase):

    # rb:test etag.small
    async def test_the_small_response_carries_a_validator(self):
        a = planned.ask("etag.small")

        answer = await send(self.async_client, a)

        floor.check(a, answer)
        self.assertTrue(answer.headers.get("etag"))

    # rb:test etag.large
    async def test_so_does_the_large_one(self):
        a = planned.ask("etag.large")

        answer = await send(self.async_client, a)

        floor.check(a, answer)
        self.assertTrue(answer.headers.get("etag"))

    # rb:test etag.match_large
    async def test_a_validator_the_target_just_issued_is_answered_with_304(self):
        a = planned.ask("etag.match_large")

        answer = await send_after_capture(self.async_client, a)

        floor.check(a, answer)
        self.assertFalse(answer.content_type)

    # rb:test etag.stale_large
    async def test_a_validator_the_target_never_issued_is_answered_in_full(self):
        a = planned.ask("etag.stale_large")

        answer = await send(self.async_client, a)

        floor.check(a, answer)
        self.assertTrue(answer.headers.get("etag"))
