#!/bin/sh
# Lambda starts each extension in /opt/extensions itself, before the runtime. lambda-emulator starts
# none, so the function starts the Lambda Web Adapter, which registers as an extension and answers
# each event through the server, and then becomes the server.
/opt/extensions/lambda-adapter &
exec python server.py
