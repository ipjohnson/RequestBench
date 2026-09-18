"""compressed: outbound gzip, the cost of the wiring declining and the cost of it working.

The family a test client can quietly fail to reach. Where a target compresses inside the
application an in-process client still runs the codec; where the compression belongs to the
server underneath, which in Python is a real possibility because the framework is not the
server, no in-process client reaches it and the only honest test is one over a real port.

The second trap is the client. Every Python HTTP client here decodes gzip before the body is
read, so a test reading the decoded body would pass every assertion below against an identity
response. conftest.send keeps the bytes as they were sent.
"""

import floor
import planned



# rb:test compressed.identity_small
def test_a_client_that_will_not_take_gzip_is_answered_in_full(send):
    a = planned.ask("compressed.identity_small")

    answer = send(a)

    floor.check(a, answer)
    assert answer.encoding == ""


# rb:test compressed.identity_large
def test_the_large_payload_is_uncompressed_too_when_identity_was_asked_for(send):
    a = planned.ask("compressed.identity_large")

    answer = send(a)

    floor.check(a, answer)
    assert answer.encoding == ""


# rb:test compressed.gzip_small
def test_a_payload_under_the_shared_floor_is_sent_uncompressed_even_so(send):
    a = planned.ask("compressed.gzip_small")

    answer = send(a)

    floor.check(a, answer)
    # spec/expected.json pins no encoding here: the small payload sits under the shared
    # gzip floor and the frameworks disagree about what to do with it. What this target
    # does is therefore the suite's to assert, not the expectation's.
    assert answer.encoding == ""


# rb:test compressed.gzip_large
def test_a_payload_over_the_floor_is_gzipped_and_says_what_it_varies_on(send):
    a = planned.ask("compressed.gzip_large")

    answer = send(a)

    floor.check(a, answer)
    assert answer.encoding == "gzip"
    # A target that gzips without Vary: Accept-Encoding passes the floor and is wrong in
    # front of any shared cache.
    assert "accept-encoding" in answer.headers.get("vary", "").lower()
