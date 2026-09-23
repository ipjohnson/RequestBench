"""The application uvicorn imports in each worker, built from the payloads RB_PAYLOADS names."""
import os

from app import build
from payloads import load

app = build(load(os.environ["RB_PAYLOADS"]))
