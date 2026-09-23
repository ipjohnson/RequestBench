import pytest

import expected


# rb:test etag.small,etag.large
@pytest.mark.corpus("etag.small", "etag.large")
@pytest.mark.parametrize("size", ["small", "large"])
def test_the_answer_carries_the_tag_the_middleware_computed(client, size):
    response = client.get(f"/etag/{size}")

    assert response.status_code == 200
    assert response.headers["etag"].startswith('"')
    assert response.json() == expected.json(f"items.{size}.json")


# rb:test etag.match_large
@pytest.mark.corpus("etag.match_large")
def test_a_matching_if_none_match_is_304_with_no_body_after_the_handler_ran(client):
    first = client.get("/etag/large")

    response = client.get("/etag/large", headers={"if-none-match": first.headers["etag"]})

    assert response.status_code == 304
    assert response.content == b""
    assert response.headers["etag"] == first.headers["etag"]
    assert int(response.headers["x-rb-serial"]) > int(first.headers["x-rb-serial"])


# rb:test etag.stale_large
@pytest.mark.corpus("etag.stale_large")
def test_a_tag_that_does_not_match_is_answered_in_full(client):
    response = client.get("/etag/large", headers={"if-none-match": expected.json("settings.json")["staleEtag"]})

    assert response.status_code == 200
    assert response.json() == expected.json("items.large.json")


def test_a_weak_tag_in_a_list_matches(client):
    tag = client.get("/etag/small").headers["etag"]

    assert client.get("/etag/small", headers={"if-none-match": f'"other", W/{tag}'}).status_code == 304


def test_a_route_outside_the_family_carries_no_tag(client):
    assert "etag" not in client.get("/json/small").headers
