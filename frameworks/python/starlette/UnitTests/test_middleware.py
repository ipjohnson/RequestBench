import pytest

import expected
from routes.middleware import Noop


# rb:test middleware.none,middleware.four,middleware.sixteen
@pytest.mark.corpus("middleware.none", "middleware.four", "middleware.sixteen")
@pytest.mark.parametrize("layers", ["none", "four", "sixteen"])
def test_the_layers_in_front_of_the_endpoint_leave_the_answer_alone(client, layers):
    response = client.get(f"/middleware/{layers}")

    assert response.json() == expected.json("items.small.json")


def test_each_route_wraps_its_endpoint_in_its_own_count_of_layers(client):
    def layers(app) -> int:
        return 1 + layers(app.app) if isinstance(app, Noop) else 0

    counts = {route.path: layers(route.app) for route in client.app.routes if route.path.startswith("/middleware/")}

    assert counts == {"/middleware/none": 0, "/middleware/four": 4, "/middleware/sixteen": 16}
