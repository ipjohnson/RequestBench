from payloads import Json


def echoed(payload: Json, echo: Json) -> Json:
    """A payload with the values a view bound written back beside its own fields."""
    return {**payload, "echo": echo}
