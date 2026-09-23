import pytest

import expected

SETTINGS = expected.json("settings.json")


# rb:test authorized.allowed
@pytest.mark.corpus("authorized.allowed")
def test_the_accepted_token_reaches_the_handler(client):
    response = client.get("/authorized/small", headers={"authorization": f"Bearer {SETTINGS['token']}"})

    assert response.status_code == 200
    assert response.json == expected.json("items.small.json")


# rb:test authorized.denied
@pytest.mark.corpus("authorized.denied")
def test_a_token_one_character_off_is_sanics_403(client):
    response = client.get("/authorized/small", headers={"authorization": f"Bearer {SETTINGS['wrongToken']}"})

    assert response.status_code == 403
    assert response.json == {"description": "Forbidden", "status": 403, "message": "Forbidden"}


def test_no_token_is_refused_too(client):
    assert client.get("/authorized/small").status_code == 403
