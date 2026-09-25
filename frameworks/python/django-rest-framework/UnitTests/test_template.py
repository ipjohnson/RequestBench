import pytest

import expected


# rb:test template.small,template.medium
@pytest.mark.corpus("template.small", "template.medium")
@pytest.mark.parametrize("size", ["small", "medium"])
def test_the_payload_is_rendered_by_the_template_html_renderer(client, size):
    response = client.get(f"/template/{size}")

    assert response.status_code == 200
    assert response.headers["content-type"] == "text/html; charset=utf-8"
    assert expected.normal(response.content.decode()) == expected.page(f"items.{size}.json")
