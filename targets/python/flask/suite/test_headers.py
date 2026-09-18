"""headers: request headers at five and at thirty, unread and with three of them bound.

/headers reads none of them and answers a fixed body, so what its two tests hold is that the
request was accepted with all of them attached. /headers/bind binds three and echoes them.
The plan reader fills the pinned body with the values it sent, so the floor check is the echo
check: a target that read the wrong header, or answered the account as a string, fails on
the body.
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


# rb:test headers.bind_few
def test_the_three_bound_headers_come_back_in_the_echo(send):
    a = planned.ask("headers.bind_few")

    answer = send(a)

    floor.check(a, answer)


# rb:test headers.bind_many
def test_and_come_back_the_same_among_thirty(send):
    a = planned.ask("headers.bind_many")

    answer = send(a)

    floor.check(a, answer)
