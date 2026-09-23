import pytest

import expected
from expected import RUN


# rb:test parameters.static
@pytest.mark.corpus("parameters.static")
def test_the_static_route_answers_the_payload(client):
    response = client.get("/parameters/static/segment/literal")

    assert response.json() == expected.json("items.small.json")


# rb:test parameters.one
@pytest.mark.corpus("parameters.one")
def test_the_capture_is_echoed_as_an_int(client):
    response = client.get(f"/parameters/{RUN['one']}/segment/literal")

    assert response.json() == expected.with_echo("items.small.json", {"one": RUN["one"]})


# rb:test parameters.two
@pytest.mark.corpus("parameters.two")
def test_both_captures_are_echoed_as_ints(client):
    response = client.get(f"/parameters/{RUN['one']}/with-second/{RUN['two']}")

    assert response.json() == expected.with_echo("items.small.json", {"one": RUN["one"], "two": RUN["two"]})


def test_a_capture_that_is_not_an_int_matches_no_route(client):
    response = client.get("/parameters/four/segment/literal")

    assert response.status_code == 404
