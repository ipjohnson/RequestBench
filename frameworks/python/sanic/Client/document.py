"""Writes the OpenAPI document sanic-ext builds from the routes to Client/openapi.json.

sanic-ext builds the document as the server starts, and serves it under /docs, which the
application turns off. This turns it back on, starts the application in process through
sanic-testing's ASGI client, which binds no socket, and asks for the document. The keys are written
sorted, because Sanic's router hands sanic-ext the routes in an order that follows Python's hash
seed.
"""
import asyncio
import json
import os
import sys
from pathlib import Path

CLIENT = Path(__file__).resolve().parent
sys.path.insert(0, str(CLIENT.parent / "Implementation"))

from importlib.metadata import version  # noqa: E402

from main import create  # noqa: E402

if "RB_PAYLOADS" not in os.environ:
    sys.exit("RB_PAYLOADS has to name the payload directory")


async def document() -> dict:
    app = create()
    app.config.update({"OAS": True, "API_TITLE": "Sanic", "API_VERSION": version("sanic")})
    # sanic-ext's default place for it.
    _, response = await app.asgi_client.get("/docs/openapi.json")
    response.raise_for_status()
    spec = response.json
    # sanic-ext labels the document OpenAPI 3.0.3 and puts Pydantic's own JSON Schema in it, which
    # is the 2020-12 dialect OpenAPI 3.1 uses. A rule such as gt=0 is "exclusiveMinimum": 0 there,
    # which 3.0 reads as a boolean, so Kiota refuses the document as 3.0.3. The label is 3.1.0, and
    # nothing else in the document changes.
    spec["openapi"] = "3.1.0"
    return spec


(CLIENT / "openapi.json").write_text(json.dumps(asyncio.run(document()), indent=2, sort_keys=True) + "\n")
