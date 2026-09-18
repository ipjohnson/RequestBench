"""body: binding and validating a request body, at two sizes and two refusals.

Where the six Python targets stop agreeing. Each reaches a different validation facility, and
the two refusals are judged as envelopes because what a framework answers when a body is wrong
is its own contract, not this repository's.
"""

import envelope
import floor
import planned

TARGET = "python:flask"



# rb:test body.bind_small
def test_a_small_body_binds(send):
    a = planned.ask("body.bind_small")

    answer = send(a)

    floor.check(a, answer)


# rb:test body.bind_medium
def test_a_medium_body_binds(send):
    a = planned.ask("body.bind_medium")

    answer = send(a)

    floor.check(a, answer)


# rb:test body.validate_small
def test_a_small_body_that_is_valid_passes_validation(send):
    a = planned.ask("body.validate_small")

    answer = send(a)

    floor.check(a, answer)


# rb:test body.validate_medium
def test_a_medium_body_that_is_valid_does_too(send):
    a = planned.ask("body.validate_medium")

    answer = send(a)

    floor.check(a, answer)


# rb:test body.rejected_all
def test_a_body_failing_three_rules_is_refused(send):
    a = planned.ask("body.rejected_all")

    answer = send(a)

    envelope.check(a, answer, TARGET)


# rb:test body.rejected_first
def test_a_body_failing_one_rule_is_refused_the_same_way(send):
    a = planned.ask("body.rejected_first")

    answer = send(a)

    envelope.check(a, answer, TARGET)
