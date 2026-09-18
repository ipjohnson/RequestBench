"""template: server-side HTML, at two sizes.

The one family whose body is not compared byte for byte. Five template engines cannot
agree on formatting without every template being contorted to match, so the spec pins the
content and leaves the whitespace free: same elements, same order, same values. The floor
normalises both sides the way the conformance client does.
"""

import floor
import planned



# rb:test template.small
def test_the_small_template_renders_the_pinned_content(send):
    a = planned.ask("template.small")

    answer = send(a)

    floor.check(a, answer)
    assert answer.content_type.startswith("text/html")


# rb:test template.medium
def test_the_medium_template_does_too(send):
    a = planned.ask("template.medium")

    answer = send(a)

    floor.check(a, answer)
