import pytest

import expected


# rb:test middleware.none,middleware.four,middleware.sixteen
@pytest.mark.corpus("middleware.none", "middleware.four", "middleware.sixteen")
@pytest.mark.parametrize("layers", ["none", "four", "sixteen"])
async def test_the_layers_in_front_of_the_view_leave_the_answer_alone(client, layers):
    response = await client.get(f"/middleware/{layers}")

    assert response.json() == expected.json("items.small.json")


async def test_each_layer_runs_its_hook_once(client, monkeypatch):
    from views.middleware import Noop

    calls = []
    monkeypatch.setattr(Noop, "process_request", lambda self, request: calls.append(request.path))

    await client.get("/middleware/four")
    await client.get("/middleware/sixteen")

    assert calls == ["/middleware/four"] * 4 + ["/middleware/sixteen"] * 16
