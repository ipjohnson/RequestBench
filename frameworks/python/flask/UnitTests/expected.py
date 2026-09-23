"""What an answer has to be, read from the committed payloads rather than from the Implementation."""
import json as _json
import os
import re
from pathlib import Path
from typing import Any


def _payloads() -> Path:
    """tests/payloads, as rb suite names it in RB_PAYLOADS, or found by walking up to the repository."""
    if "RB_PAYLOADS" in os.environ:
        return Path(os.environ["RB_PAYLOADS"])
    for directory in Path(__file__).resolve().parents:
        candidate = directory / "tests" / "payloads"
        if (candidate / "items.large.json").exists():
            return candidate
    raise FileNotFoundError(f"no tests/payloads above {__file__}")


DIRECTORY = _payloads()

# The values a run draws, fixed as orchestrator/test/reference.ts fixes them.
RUN = {
    "one": 4821,
    "two": 7390,
    "tenant": "qwertyuiopas",
    "requestId": "0123456789abcdef",
    "account": 482913,
    "page": 417,
    "size": 38,
    "status": "paid",
    "category": "garden",
    "sort": "created",
    "q": "alpha bravo",
    "minPrice": 1200,
    "maxPrice": 34000,
}

SEARCH = ("page", "size", "status", "category", "sort", "q", "minPrice", "maxPrice")


def raw(file: str) -> bytes:
    return (DIRECTORY / file).read_bytes()


def json(file: str) -> Any:
    return _json.loads(raw(file))


def with_echo(file: str, echo: dict[str, Any]) -> dict[str, Any]:
    """A payload with an echo object beside its own fields, as a binding handler answers."""
    return {**json(file), "echo": echo}


def row(id: int) -> dict[str, Any]:
    return next(r for r in json("items.large.json")["items"] if r["id"] == id)


def page(file: str) -> str:
    """The page the template rows render, as tests/payloads/index.ts writes it."""
    p = json(file)
    rows = "".join(
        f"<tr><td>{it['id']}</td><td>{it['name']}</td><td>{it['category']}</td><td>{it['priceCents']}</td>"
        f"<td>{'yes' if it['inStock'] else 'no'}</td></tr>"
        for it in p["items"]
    )
    return (
        "<!doctype html><html><head><title>items</title></head><body>"
        f"<h1>{p['size']}</h1><table><thead><tr><th>id</th><th>name</th><th>category</th><th>price</th><th>stock</th></tr></thead>"
        f"<tbody>{rows}</tbody></table><p>{p['count']} rows</p></body></html>"
    )


def normal(html: str) -> str:
    """Whitespace at an element boundary removed and every other run collapsed, as the corpus compares a page."""
    return re.sub(r"[ ]+<", "<", re.sub(r">[ ]+", ">", re.sub(r"[ \t\n\r\f\v]+", " ", html))).strip()
