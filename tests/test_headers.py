"""The headers family: eager against lazy construction of the request header map."""
from _family import build

test_endpoint = build("headers")
