"""parameters: route capture, at zero, one and two segments.

The captured values do not reach the answer. The payload is the shared one, so what these
hold is that the route matched at all: a target whose two-segment pattern is wrong answers
404 and the floor says so on the status line before it ever looks at a body.
"""

import floor
import planned



# rb:test parameters.static
def test_a_route_with_nothing_to_capture_matches(send):
    a = planned.ask("parameters.static")

    answer = send(a)

    floor.check(a, answer)


# rb:test parameters.one
def test_one_captured_segment_matches(send):
    a = planned.ask("parameters.one")

    answer = send(a)

    floor.check(a, answer)


# rb:test parameters.two
def test_two_captured_segments_match(send):
    a = planned.ask("parameters.two")

    answer = send(a)

    floor.check(a, answer)
