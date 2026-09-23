import pytest

# errors: every refusal is Django's own. A 404, a 403 and a 400 are Django's default error pages,
# written as HTML, and a 405 is a View's own answer. Nothing here reshapes any of them.


# rb:test errors.unmatched
@pytest.mark.corpus("errors.unmatched")
async def test_a_path_no_pattern_matches_is_djangos_404(client):
    response = await client.get("/errors/unmatched")

    assert response.status_code == 404
    assert response.headers["content-type"].startswith("text/html")
    assert b"<h1>Not Found</h1>" in response.content


# rb:test errors.not_found
@pytest.mark.corpus("errors.not_found")
async def test_an_id_with_no_row_is_the_same_404(client):
    response = await client.get("/items/999999")

    assert response.status_code == 404
    assert b"<h1>Not Found</h1>" in response.content


# rb:test errors.wrong_method
@pytest.mark.corpus("errors.wrong_method")
async def test_a_method_the_view_has_no_handler_for_is_405(client):
    response = await client.post("/items/17")

    assert response.status_code == 405
    assert response.headers["allow"] == "GET, PUT, PATCH, DELETE, HEAD, OPTIONS"


# rb:test errors.malformed
@pytest.mark.corpus("errors.malformed")
async def test_a_body_that_is_not_json_is_djangos_400(client):
    response = await client.post("/body/validate/small", b'{"customerId": 1, "lines": [', content_type="application/json")

    assert response.status_code == 400
    assert b"<h1>Bad Request (400)</h1>" in response.content


async def test_a_body_that_is_json_but_no_object_is_the_same_400(client):
    response = await client.post("/body/validate/small", b"[1, 2]", content_type="application/json")

    assert response.status_code == 400
