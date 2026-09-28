import pytest

import expected


# rb:test static.small,static.medium,static.large
@pytest.mark.corpus("static.small", "static.medium", "static.large")
@pytest.mark.parametrize("name", ["items.small.json", "items.medium.json", "items.large.json"])
def test_the_committed_file_is_served_byte_for_byte(client, name):
    file = expected.raw(name)

    response = client.get(f"/static/{name}")

    body = b"".join(response.streaming_content)
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("application/json")
    assert response.headers["content-length"] == str(len(file))
    assert "last-modified" in response.headers
    assert body == file
