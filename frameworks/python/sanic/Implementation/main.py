"""The application each Sanic worker builds, from the payloads RB_PAYLOADS names."""
import os

from sanic import Sanic

from app import build
from payloads import load


def create() -> Sanic:
    return build(load(os.environ["RB_PAYLOADS"]))
