from typing import Any

from payloads import Json


def echoed(payload: Json, echo: dict[str, Any]) -> Json:
    """A payload with the values a handler bound written back beside its own fields."""
    return {**payload, "echo": echo}
