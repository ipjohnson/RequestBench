import pytest

import expected
from expected import RUN, SEARCH


# rb:test query.one
@pytest.mark.corpus("query.one")
def test_the_page_is_echoed_as_an_int(client):
    response = client.get("/query/one", {"page": str(RUN["page"])})

    assert response.json() == expected.with_echo("items.small.json", {"page": RUN["page"]})


# rb:test query.many
@pytest.mark.corpus("query.many")
def test_eight_values_are_echoed_the_numbers_as_ints(client):
    response = client.get("/query/many", {name: str(RUN[name]) for name in SEARCH})

    assert response.json() == expected.with_echo("items.small.json", {name: RUN[name] for name in SEARCH})


def test_a_missing_value_is_the_serializers_400(client):
    response = client.get("/query/one")

    assert response.status_code == 400
    assert response.json() == {"page": ["This field is required."]}


def test_a_value_that_is_no_int_is_the_serializers_400(client):
    response = client.get("/query/one", {"page": "first"})

    assert response.status_code == 400
    assert response.json() == {"page": ["A valid integer is required."]}
