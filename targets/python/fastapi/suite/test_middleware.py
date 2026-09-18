"""middleware: per-layer dispatch cost at 0, 4 and 16 no-op layers.

The layers are no-ops, so nothing they do is visible in a response and no assertion over
one can tell four apart from sixteen. What a test can hold is the thing that goes wrong in
practice: a test that calls the handler rather than the app passes while the layers never
ran at all. The test host boots the application, so the layers are in the path here by
construction, and that is the whole of what these three assert.
"""

import floor
import planned



# rb:test middleware.none
def test_the_unlayered_route_answers_the_shared_payload(send):
    a = planned.ask("middleware.none")

    answer = send(a)

    floor.check(a, answer)


# rb:test middleware.four
def test_four_layers_do_not_change_the_answer(send):
    a = planned.ask("middleware.four")

    answer = send(a)

    floor.check(a, answer)


# rb:test middleware.sixteen
def test_sixteen_layers_do_not_change_it_either(send):
    a = planned.ask("middleware.sixteen")

    answer = send(a)

    floor.check(a, answer)
