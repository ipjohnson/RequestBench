"""cache: the framework's own response cache, and what it is keyed on.

The vary rows are the ones worth having. A store keyed on fewer headers than it declares
answers one tenant with another tenant's body, and that is a correctness failure a latency
chart renders as a target that got faster.
"""

import floor
import planned



# rb:test cache.small
def test_the_small_cached_response_is_what_the_spec_pins(send):
    a = planned.ask("cache.small")

    answer = send(a)

    floor.check(a, answer)


# rb:test cache.medium
def test_the_medium_one_is_too(send):
    a = planned.ask("cache.medium")

    answer = send(a)

    floor.check(a, answer)


# rb:test cache.large
def test_and_the_large_one(send):
    a = planned.ask("cache.large")

    answer = send(a)

    floor.check(a, answer)


# rb:test cache.vary_one
def test_a_response_varying_on_one_header_says_so(send):
    a = planned.ask("cache.vary_one")

    answer = send(a)

    floor.check(a, answer)


# rb:test cache.vary_many
def test_and_one_varying_on_three_says_all_three(send):
    a = planned.ask("cache.vary_many")

    answer = send(a)

    floor.check(a, answer)
