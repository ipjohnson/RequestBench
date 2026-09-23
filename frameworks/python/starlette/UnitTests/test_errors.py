import pytest

# errors: every refusal is Starlette's or SpecTree's own. Starlette writes its refusals as text, and
# SpecTree writes JSON. Nothing here reshapes any of them.


# rb:test errors.unmatched
@pytest.mark.corpus("errors.unmatched")
def test_a_path_no_route_matches_is_the_routers_404(client):
    response = client.get("/errors/unmatched")

    assert response.status_code == 404
    assert response.headers["content-type"].startswith("text/plain")
    assert response.text == "Not Found"


# rb:test errors.not_found
@pytest.mark.corpus("errors.not_found")
def test_an_id_with_no_row_is_the_endpoints_404(client):
    response = client.get("/items/999999")

    assert response.status_code == 404
    assert response.text == "Not Found"


# rb:test errors.wrong_method
@pytest.mark.corpus("errors.wrong_method")
def test_a_method_the_endpoint_has_no_function_for_is_405(client):
    response = client.post("/items/17")

    assert response.status_code == 405
    assert response.text == "Method Not Allowed"
    assert response.headers["allow"] == "GET, PUT, PATCH, DELETE"


# rb:test errors.malformed
@pytest.mark.corpus("errors.malformed")
def test_a_body_that_is_not_json_is_spectrees_422(client):
    response = client.post("/body/validate/small", content=b'{"customerId": 1, "lines": [', headers={"content-type": "application/json"})

    assert response.status_code == 422
    assert response.json() == {"error_msg": "Expecting value: line 1 column 29 (char 28)"}
