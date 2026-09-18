"""authorized: one endpoint that refuses, and one that does not.

The pair is the test. A target that let everything through would pass the allowed case and
nothing else, so the denial is what carries the family, and its envelope is the
framework's own rather than this repository's.
"""

import envelope
import floor
import planned

TARGET = "python:starlette"



# rb:test authorized.allowed
def test_a_request_carrying_the_token_is_served(send):
    a = planned.ask("authorized.allowed")

    answer = send(a)

    floor.check(a, answer)


# rb:test authorized.denied
def test_a_request_with_the_wrong_token_is_refused_in_the_frameworks_own_shape(send):
    a = planned.ask("authorized.denied")

    answer = send(a)

    envelope.check(a, answer, TARGET)
