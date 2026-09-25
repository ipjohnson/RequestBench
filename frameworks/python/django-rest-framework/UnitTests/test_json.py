import json

import pytest

import expected


# rb:test json.small,json.medium,json.large
@pytest.mark.corpus("json.small", "json.medium", "json.large")
@pytest.mark.parametrize("size", ["small", "medium", "large"])
def test_the_payload_is_rendered_by_jsonrenderer(client, size):
    response = client.get(f"/json/{size}")

    assert response.status_code == 200
    assert response.headers["content-type"] == "application/json"
    assert response.json() == expected.json(f"items.{size}.json")


def test_jsonrenderer_writes_compact_json_in_the_payloads_order(client):
    compact = json.dumps(expected.json("items.small.json"), separators=(",", ":"), ensure_ascii=False).encode()

    assert client.get("/json/small").content == compact


def test_every_answer_names_the_methods_its_view_answers(client):
    assert set(client.get("/json/small").headers["allow"].split(", ")) == {"GET", "OPTIONS"}
