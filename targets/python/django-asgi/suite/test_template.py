"""template: server-side HTML, at two sizes.

The one family whose body is not compared byte for byte. Five template engines cannot
agree on formatting without every template being contorted to match, so the spec pins the
content and leaves the whitespace free: same elements, same order, same values. The floor
normalises both sides the way the conformance client does.
"""
from django.test import SimpleTestCase

import floor
import planned
from support import send


class TemplateTests(SimpleTestCase):

    # rb:test template.small
    async def test_the_small_template_renders_the_pinned_content(self):
        a = planned.ask("template.small")

        answer = await send(self.async_client, a)

        floor.check(a, answer)
        self.assertTrue(answer.content_type.startswith("text/html"))

    # rb:test template.medium
    async def test_the_medium_template_does_too(self):
        a = planned.ask("template.medium")

        answer = await send(self.async_client, a)

        floor.check(a, answer)
