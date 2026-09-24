"""RequestBench framework: Flask as a Lambda function, behind apig-wsgi.

The base image's runtime client, awslambdaric, imports this module from the task root and calls
handler with each event it asks the Runtime API for. apig-wsgi turns the event, an API Gateway
payload format 2.0 request, into a WSGI request for the application, and the answer into a proxy
response.
"""
import os
from importlib.metadata import version

# A function is one process, which answers one event at a time on one thread. Both are set before
# the application is imported, because routes/contract.py imports them from this module.
WORKERS = 1
THREADS = 1
# What /__meta names as the adapter. contract.py imports it with WORKERS.
ADAPTER = f"apig-wsgi {version('apig-wsgi')}"

if "RB_PAYLOADS" not in os.environ:
    raise RuntimeError("RB_PAYLOADS has to name the payload directory")

from apig_wsgi import make_lambda_handler  # noqa: E402

from app import build  # noqa: E402
from payloads import load  # noqa: E402

handler = make_lambda_handler(build(load(os.environ["RB_PAYLOADS"])))
