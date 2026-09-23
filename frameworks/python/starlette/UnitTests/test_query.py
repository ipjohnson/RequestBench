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


def test_a_missing_value_is_refused_by_spectree(client):
    response = client.get("/query/one")

    assert response.status_code == 422
    assert response.json()[0]["type"] == "missing"
    assert response.json()[0]["loc"] == ["page"]
