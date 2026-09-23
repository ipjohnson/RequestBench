"""Writes the OpenAPI document Litestar builds from the handlers' signatures to Client/openapi.json.

build() gives the application no OpenAPIConfig, so the image serves no documentation routes. This
script passes one, which adds those routes and changes no other, and asks the application for its
document. Nothing listens. The document is what litestar-vite exports before it runs Hey API.
"""
import json
import os
import sys
from pathlib import Path

CLIENT = Path(__file__).resolve().parent
sys.path.insert(0, str(CLIENT.parent / "Implementation"))

from litestar.openapi import OpenAPIConfig  # noqa: E402

from app import build  # noqa: E402
from payloads import load  # noqa: E402

if "RB_PAYLOADS" not in os.environ:
    sys.exit("RB_PAYLOADS has to name the payload directory")

app = build(load(os.environ["RB_PAYLOADS"]), OpenAPIConfig(title="Litestar", version="1.0.0"))
(CLIENT / "openapi.json").write_text(json.dumps(app.openapi_schema.to_schema(), indent=2) + "\n")
