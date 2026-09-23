import pytest

import expected


# rb:test json.small,json.medium,json.large
@pytest.mark.corpus("json.small", "json.medium", "json.large")
@pytest.mark.parametrize("size", ["small", "medium", "large"])
def test_the_payload_is_serialised_by_jsonresponse(client, size):
    response = client.get(f"/json/{size}")

    assert response.status_code == 200
    assert response.headers["content-type"] == "application/json"
    assert response.json() == expected.json(f"items.{size}.json")
