import pytest

import expected

SETTINGS = expected.json("settings.json")


# rb:test authorized.allowed
@pytest.mark.corpus("authorized.allowed")
def test_the_accepted_token_reaches_the_handler(client):
    response = client.get("/authorized/small", headers={"authorization": f"Bearer {SETTINGS['token']}"})

    assert response.status_code == 200
    assert response.json() == expected.json("items.small.json")


# rb:test authorized.denied
@pytest.mark.corpus("authorized.denied")
def test_a_token_one_character_off_is_the_guards_403(client):
    response = client.get("/authorized/small", headers={"authorization": f"Bearer {SETTINGS['wrongToken']}"})

    assert response.status_code == 403
    assert response.json() == {"status_code": 403, "detail": "Forbidden"}


def test_no_token_is_refused_the_same_way(client):
    assert client.get("/authorized/small").status_code == 403
