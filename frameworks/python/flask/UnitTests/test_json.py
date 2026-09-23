import pytest

import expected


# rb:test json.small,json.medium,json.large
@pytest.mark.corpus("json.small", "json.medium", "json.large")
@pytest.mark.parametrize("size", ["small", "medium", "large"])
def test_the_dict_the_view_returns_is_serialised_by_flasks_provider(client, size):
    response = client.get(f"/json/{size}")

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("application/json")
    assert response.json == expected.json(f"items.{size}.json")


def test_the_provider_sorts_the_keys(client):
    assert client.get("/json/small").text.startswith('{"count":1,"items":[{"category":')
