import pytest

import expected


# rb:test middleware.none,middleware.four,middleware.sixteen
@pytest.mark.corpus("middleware.none", "middleware.four", "middleware.sixteen")
@pytest.mark.parametrize("layers", ["none", "four", "sixteen"])
def test_the_blueprint_middleware_in_front_of_the_handler_leaves_the_answer_alone(client, layers):
    response = client.get(f"/middleware/{layers}")

    assert response.json == expected.json("items.small.json")
