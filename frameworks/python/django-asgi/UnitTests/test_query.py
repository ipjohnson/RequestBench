import pytest

import expected
from expected import RUN, SEARCH


# rb:test query.one
@pytest.mark.corpus("query.one")
async def test_the_page_is_echoed_as_an_int(client):
    response = await client.get("/query/one", query_params={"page": str(RUN["page"])})

    assert response.json() == expected.with_echo("items.small.json", {"page": RUN["page"]})


# rb:test query.many
@pytest.mark.corpus("query.many")
async def test_eight_values_are_echoed_the_numbers_as_ints(client):
    response = await client.get("/query/many", query_params={name: str(RUN[name]) for name in SEARCH})

    assert response.json() == expected.with_echo("items.small.json", {name: RUN[name] for name in SEARCH})


async def test_a_missing_value_is_the_forms_400(client):
    response = await client.get("/query/one")

    assert response.status_code == 400
    assert response.json() == {"page": ["This field is required."]}
