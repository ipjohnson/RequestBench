import pytest

import expected


# rb:test static.file
@pytest.mark.corpus("static.file")
def test_the_committed_file_is_served_byte_for_byte(client):
    file = expected.raw("items.large.json")

    response = client.get("/static/items.large.json")

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("application/json")
    assert response.headers["content-length"] == str(len(file))
    assert "last-modified" in response.headers
    assert response.content == file


def test_the_files_own_etag_is_answered_in_full(client):
    tag = client.get("/static/items.large.json").headers["etag"]

    response = client.get("/static/items.large.json", headers={"if-none-match": tag})

    assert response.status_code == 200
    assert response.content == expected.raw("items.large.json")
