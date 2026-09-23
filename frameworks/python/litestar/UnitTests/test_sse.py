import json

import pytest

import expected


# rb:test sse.medium
@pytest.mark.corpus("sse.medium")
def test_each_row_of_items_medium_is_the_data_of_one_event(client):
    response = client.get("/sse/medium", headers={"accept": "text/event-stream"})

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/event-stream")
    assert "content-length" not in response.headers
    events = [event for event in response.text.split("\r\n\r\n") if event]
    assert [json.loads(event.removeprefix("data: ")) for event in events] == expected.json("items.medium.json")["items"]
