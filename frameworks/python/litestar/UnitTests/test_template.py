import pytest

import expected


# rb:test template.small,template.medium
@pytest.mark.corpus("template.small", "template.medium")
@pytest.mark.parametrize("size", ["small", "medium"])
def test_the_payload_is_rendered_by_the_jinja2_template(client, size):
    response = client.get(f"/template/{size}")

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/html")
    assert expected.normal(response.text) == expected.page(f"items.{size}.json")
