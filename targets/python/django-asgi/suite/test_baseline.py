"""baseline: the dispatch floor, with no serialization in the way.

The one endpoint in the corpus that answers a literal. Its whole contract is the string
and the content type, and the content type is the half a test gets wrong: a target that
answers "Hello, World!" as application/json has passed the body and failed the endpoint.
The floor checks the kind of body before the body for that reason.
"""
from django.test import SimpleTestCase

import floor
import planned
from support import send


class BaselineTests(SimpleTestCase):

    # rb:test baseline.plaintext
    async def test_the_plaintext_route_answers_a_literal_as_text(self):
        a = planned.ask("baseline.plaintext")

        answer = await send(self.async_client, a)

        floor.check(a, answer)
        self.assertTrue(answer.content_type.startswith("text/plain"))
