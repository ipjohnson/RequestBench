import pytest

import expected

SETTINGS = expected.json("settings.json")


# rb:test authorized.allowed
@pytest.mark.corpus("authorized.allowed")
def test_the_accepted_token_reaches_the_endpoint(client):
    response = client.get("/authorized/small", headers={"authorization": f"Bearer {SETTINGS['token']}"})

    assert response.status_code == 200
    assert response.json() == expected.json("items.small.json")


# rb:test authorized.denied
@pytest.mark.corpus("authorized.denied")
def test_a_token_one_character_off_is_refused_by_requires_with_403(client):
    response = client.get("/authorized/small", headers={"authorization": f"Bearer {SETTINGS['wrongToken']}"})

    assert response.status_code == 403
    assert response.text == "Forbidden"


def test_no_token_is_unauthenticated_too(client):
    assert client.get("/authorized/small").status_code == 403


def test_a_route_outside_the_family_runs_no_authentication(client):
    assert client.get("/json/small", headers={"authorization": f"Bearer {SETTINGS['wrongToken']}"}).status_code == 200
