import pytest

import expected
from expected import RUN, SEARCH


# rb:test query.one
@pytest.mark.corpus("query.one")
def test_the_page_is_echoed_as_an_int(client):
    response = client.get("/query/one", params={"page": str(RUN["page"])})

    assert response.json() == expected.with_echo("items.small.json", {"page": RUN["page"]})


# rb:test query.many
@pytest.mark.corpus("query.many")
def test_eight_values_are_echoed_the_numbers_as_ints(client):
    response = client.get("/query/many", params={name: str(RUN[name]) for name in SEARCH})

    assert response.json() == expected.with_echo("items.small.json", {name: RUN[name] for name in SEARCH})


def test_a_missing_value_is_refused_naming_the_parameter(client):
    response = client.get("/query/one")

    assert response.status_code == 400
    assert response.json() == {"status_code": 400, "detail": "Missing required query parameter 'page' for path /query/one"}


def test_a_value_that_is_not_an_int_is_refused_by_msgspec(client):
    response = client.get("/query/one", params={"page": "four"})

    assert response.status_code == 400
    assert response.json()["extra"] == [{"message": "Expected `int`, got `str`", "key": "page", "source": "query"}]
