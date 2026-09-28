import pytest

import expected

TOKEN = "5a7cc77ed0dcb825806b6f872026c317"
WRONG_TOKEN = "5a7cc77ed0dcb825806b6f872026c310"


# rb:test authorized.allowed
@pytest.mark.corpus("authorized.allowed")
async def test_the_accepted_token_reaches_the_view(client):
    response = await client.get("/authorized/small", headers={"authorization": f"Bearer {TOKEN}"})

    assert response.status_code == 200
    assert response.json() == expected.json("items.small.json")


# rb:test authorized.denied
@pytest.mark.corpus("authorized.denied")
async def test_a_token_one_character_off_is_djangos_403(client):
    response = await client.get("/authorized/small", headers={"authorization": f"Bearer {WRONG_TOKEN}"})

    assert response.status_code == 403
    assert response.headers["content-type"].startswith("text/html")


async def test_no_token_is_refused_the_same_way(client):
    response = await client.get("/authorized/small")

    assert response.status_code == 403
