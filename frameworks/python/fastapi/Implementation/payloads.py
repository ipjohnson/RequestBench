"""The committed payloads, read from the directory RB_PAYLOADS names as each worker imports the
application, so a missing or broken file stops the boot rather than failing a request. The parsed
models are kept and serialised on every request."""
from dataclasses import dataclass
from pathlib import Path

# rb:wiring json.*
from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel


# rb:wiring json.*
class Camel(BaseModel):
    """A model whose JSON names are camelCase, as every name in the corpus is. FastAPI serializes
    a declared return type with Pydantic, straight to JSON bytes."""

    model_config = ConfigDict(alias_generator=to_camel, validate_by_name=True, serialize_by_alias=True)


class Item(Camel):
    """One row of items.large, and of every payload made from it."""

    id: int
    name: str
    category: str
    price_cents: int
    in_stock: bool


class Payload(Camel):
    """items.small, items.medium or items.large."""

    size: str
    count: int
    items: list[Item]
# rb:end


class Vary(Camel):
    """The values each vary row is keyed on, by header."""

    one: dict[str, list[str]]
    many: dict[str, list[str]]


class CacheSettings(Camel):
    capacity: int
    ttl_seconds: int
    vary: Vary


class CorsSettings(Camel):
    origin: str
    method: str
    header: str
    max_age_seconds: int


class Settings(Camel):
    """The values the framework configures itself from, as settings.json holds them."""

    token: str
    wrong_token: str
    stale_etag: str
    cache: CacheSettings
    cors: CorsSettings


@dataclass(frozen=True)
class Payloads:
    directory: Path
    small: Payload
    medium: Payload
    large: Payload
    settings: Settings
    rows: dict[int, Item]

    def row(self, id: int) -> Item | None:
        """The row of items.large with this id, or None when there is none."""
        return self.rows.get(id)


def load(directory: str) -> Payloads:
    root = Path(directory).resolve()
    large = Payload.model_validate_json((root / "items.large.json").read_bytes())
    return Payloads(
        directory=root,
        small=Payload.model_validate_json((root / "items.small.json").read_bytes()),
        medium=Payload.model_validate_json((root / "items.medium.json").read_bytes()),
        large=large,
        settings=Settings.model_validate_json((root / "settings.json").read_bytes()),
        rows={row.id: row for row in large.items},
    )
