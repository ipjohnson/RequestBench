"""errors: the three refusals that are nobody's fault but the request's.

All three are envelopes rather than pinned bodies. errors.unmatched is the one that tests
the framework rather than the handler: nothing registers that path, so what answers is
whatever the target does with a route it does not have.
"""

import envelope
import floor
import planned

TARGET = "python:starlette"



# rb:test errors.not_found
def test_a_registered_route_with_no_such_row_answers_404(send):
    a = planned.ask("errors.not_found")

    answer = send(a)

    envelope.check(a, answer, TARGET)


# rb:test errors.unmatched
def test_a_path_nothing_registers_answers_the_frameworks_own_404(send):
    a = planned.ask("errors.unmatched")

    answer = send(a)

    envelope.check(a, answer, TARGET)


# rb:test errors.malformed
def test_a_body_that_is_not_json_at_all_is_refused(send):
    a = planned.ask("errors.malformed")

    answer = send(a)

    envelope.check(a, answer, TARGET)
