from payloads import Payload


class Echoed[T](Payload):
    """A payload with the values a handler bound written back beside its own fields."""

    echo: T

    @classmethod
    def of(cls, payload: Payload, echo: T) -> "Echoed[T]":
        return cls(size=payload.size, count=payload.count, items=payload.items, echo=echo)
