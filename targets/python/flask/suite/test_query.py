"""query: parsing and coercing query parameters, at one and at eight.

The values never reach the answer, which is the point: this family is the parse and the
coercion isolated from any use of them. A target that silently drops a parameter it cannot
coerce answers the same body as one that read all eight, so what these hold is the status.
"""

import floor
import planned



# rb:test query.one
def test_one_query_parameter_is_read(send):
    a = planned.ask("query.one")

    answer = send(a)

    floor.check(a, answer)


# rb:test query.many
def test_eight_of_them_are_read_and_coerced(send):
    a = planned.ask("query.many")

    answer = send(a)

    floor.check(a, answer)
