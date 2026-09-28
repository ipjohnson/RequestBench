"""RequestBench framework: FastAPI as a Lambda function, served by uvicorn behind the Lambda Web
Adapter.

start.sh starts the adapter beside this process. The adapter asks the Runtime API for each event,
sends it to uvicorn on loopback as an HTTP request, and streams uvicorn's answer back.
"""
import os
from importlib.metadata import version

import uvicorn

# A function is one process, which answers one event at a time, so uvicorn runs the application in
# this process rather than in workers of its own.
WORKERS = 1
# What /__meta names as the adapter. contract.py imports it with WORKERS. The Dockerfile names the
# Lambda Web Adapter it copies in.
ADAPTER = f"uvicorn {version('uvicorn')} behind {os.environ['RB_LAMBDA_ADAPTER']}"

if __name__ == "__main__":
    if "RB_PAYLOADS" not in os.environ:
        raise SystemExit("RB_PAYLOADS has to name the payload directory")
    # No access log, as on container-h1.
    uvicorn.run("main:app", host="127.0.0.1", port=int(os.environ["AWS_LWA_PORT"]), workers=WORKERS, access_log=False)
