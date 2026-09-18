"""baseline: the dispatch floor, with no serialization in the way.

The one endpoint in the corpus that answers a literal. Its whole contract is the string
and the content type, and the content type is the half a test gets wrong: a target that
answers "Hello, World!" as application/json has passed the body and failed the endpoint.
The floor checks the kind of body before the body for that reason.
"""

import floor
import planned



# rb:test baseline.plaintext
def test_the_plaintext_route_answers_a_literal_as_text(send):
    a = planned.ask("baseline.plaintext")

    answer = send(a)

    floor.check(a, answer)
    assert answer.content_type.startswith("text/plain")
