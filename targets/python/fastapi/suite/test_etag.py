"""etag: the validator a target computes, and what it does when one comes back.

The 304 is the interesting one: it is the only request in the corpus that cannot be sent until
the target has answered a different one, because the validator is the target's to produce.
"""

import floor
import planned



# rb:test etag.small
def test_the_small_response_carries_a_validator(send):
    a = planned.ask("etag.small")

    answer = send(a)

    floor.check(a, answer)
    assert answer.headers.get("etag")


# rb:test etag.large
def test_so_does_the_large_one(send):
    a = planned.ask("etag.large")

    answer = send(a)

    floor.check(a, answer)
    assert answer.headers.get("etag")


# rb:test etag.match_large
def test_a_validator_the_target_just_issued_is_answered_with_304(send_after_capture):
    a = planned.ask("etag.match_large")

    answer = send_after_capture(a)

    floor.check(a, answer)
    assert not answer.content_type


# rb:test etag.stale_large
def test_a_validator_the_target_never_issued_is_answered_in_full(send):
    a = planned.ask("etag.stale_large")

    answer = send(a)

    floor.check(a, answer)
    assert answer.headers.get("etag")
