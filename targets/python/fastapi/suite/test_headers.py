"""headers: reading request headers, at a few and at many.

The header count is the variable and the body is fixed, so a target that stopped reading
headers at some limit would answer this correctly and still be wrong. What a response can
hold is that the request was accepted with all of them attached, which is what these do.
"""

import floor
import planned



# rb:test headers.few
def test_a_request_carrying_a_few_headers_is_served(send):
    a = planned.ask("headers.few")

    answer = send(a)

    floor.check(a, answer)


# rb:test headers.many
def test_and_one_carrying_many_is_served_the_same_way(send):
    a = planned.ask("headers.many")

    answer = send(a)

    floor.check(a, answer)
