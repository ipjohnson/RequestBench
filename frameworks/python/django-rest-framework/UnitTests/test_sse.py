import json

import pytest

import expected


# rb:test sse.medium
@pytest.mark.corpus("sse.medium")
def test_each_row_of_items_medium_is_the_data_of_one_event(client):
    response = client.get("/sse/medium", headers={"accept": "text/event-stream"})

    body = b"".join(response.streaming_content).decode()
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/event-stream")
    assert "content-length" not in response.headers
    events = [event for event in body.split("\n\n") if event]
    assert [json.loads(event.removeprefix("data: ")) for event in events] == expected.json("items.medium.json")["items"]


def test_drfs_negotiation_refuses_a_type_the_view_does_not_offer(client):
    assert client.get("/sse/medium", headers={"accept": "application/json"}).status_code == 406
