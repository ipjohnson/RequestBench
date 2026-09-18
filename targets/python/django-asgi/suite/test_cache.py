"""cache: the framework's own response cache, and what it is keyed on.

The vary rows are the ones worth having. A store keyed on fewer headers than it declares
answers one tenant with another tenant's body, and that is a correctness failure a latency
chart renders as a target that got faster.
"""
from django.test import SimpleTestCase

import floor
import planned
from support import send


class CacheTests(SimpleTestCase):

    # rb:test cache.small
    async def test_the_small_cached_response_is_what_the_spec_pins(self):
        a = planned.ask("cache.small")

        answer = await send(self.async_client, a)

        floor.check(a, answer)

    # rb:test cache.medium
    async def test_the_medium_one_is_too(self):
        a = planned.ask("cache.medium")

        answer = await send(self.async_client, a)

        floor.check(a, answer)

    # rb:test cache.large
    async def test_and_the_large_one(self):
        a = planned.ask("cache.large")

        answer = await send(self.async_client, a)

        floor.check(a, answer)

    # rb:test cache.vary_one
    async def test_a_response_varying_on_one_header_says_so(self):
        a = planned.ask("cache.vary_one")

        answer = await send(self.async_client, a)

        floor.check(a, answer)

    # rb:test cache.vary_many
    async def test_and_one_varying_on_three_says_all_three(self):
        a = planned.ask("cache.vary_many")

        answer = await send(self.async_client, a)

        floor.check(a, answer)
