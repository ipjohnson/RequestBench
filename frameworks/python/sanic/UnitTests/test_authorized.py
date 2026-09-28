import pytest

import expected

TOKEN = "5a7cc77ed0dcb825806b6f872026c317"
WRONG_TOKEN = "5a7cc77ed0dcb825806b6f872026c310"


# rb:test authorized.allowed
@pytest.mark.corpus("authorized.allowed")
def test_the_accepted_token_reaches_the_handler(client):
    response = client.get("/authorized/small", headers={"authorization": f"Bearer {TOKEN}"})

    assert response.status_code == 200
    assert response.json == expected.json("items.small.json")


# rb:test authorized.denied
@pytest.mark.corpus("authorized.denied")
def test_a_token_one_character_off_is_sanics_403(client):
    response = client.get("/authorized/small", headers={"authorization": f"Bearer {WRONG_TOKEN}"})

    assert response.status_code == 403
    assert response.json == {"description": "Forbidden", "status": 403, "message": "Forbidden"}


def test_no_token_is_refused_too(client):
    assert client.get("/authorized/small").status_code == 403
