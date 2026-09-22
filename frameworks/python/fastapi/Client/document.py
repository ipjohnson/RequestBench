"""Writes the OpenAPI document FastAPI builds from the routes' type hints to Client/openapi.json.

The application turns its documentation routes off, which stops FastAPI serving the document and
not building it. Nothing listens. Routes on a mounted sub-application are not in it, which is how
FastAPI documents one: compressed, cors and static are mounted.
"""
import json
import os
import sys
from pathlib import Path

# FastAPI names a route with two methods, such as GET and HEAD on /items/{id}, after the first in a
# set, and a set's order follows the hash seed. One seed writes the same document on every run.
if os.environ.get("PYTHONHASHSEED") != "0":
    os.execve(sys.executable, [sys.executable, *sys.argv], {**os.environ, "PYTHONHASHSEED": "0"})

CLIENT = Path(__file__).resolve().parent
sys.path.insert(0, str(CLIENT.parent / "Implementation"))

from app import build  # noqa: E402
from payloads import load  # noqa: E402

if "RB_PAYLOADS" not in os.environ:
    sys.exit("RB_PAYLOADS has to name the payload directory")

document = build(load(os.environ["RB_PAYLOADS"])).openapi()
(CLIENT / "openapi.json").write_text(json.dumps(document, indent=2) + "\n")
