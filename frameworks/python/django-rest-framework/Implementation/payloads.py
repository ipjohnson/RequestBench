"""The committed payloads, read from the directory RB_PAYLOADS names when settings.py is imported,
so a missing or broken file stops a worker's boot rather than failing a request. Each is kept as
the dict json.loads made of it, and JSONRenderer renders it again on every request."""
import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any

type Json = dict[str, Any]


@dataclass(frozen=True)
class Payloads:
    directory: Path
    small: Json
    medium: Json
    large: Json
    settings: Json
    rows: dict[int, Json]

    def row(self, id: int) -> Json | None:
        """The row of items.large with this id, or None when there is none."""
        return self.rows.get(id)


def load(directory: str) -> Payloads:
    root = Path(directory).resolve()

    def read(name: str) -> Json:
        return json.loads((root / name).read_bytes())

    large = read("items.large.json")
    return Payloads(
        directory=root,
        small=read("items.small.json"),
        medium=read("items.medium.json"),
        large=large,
        settings=read("settings.json"),
        rows={row["id"]: row for row in large["items"]},
    )
