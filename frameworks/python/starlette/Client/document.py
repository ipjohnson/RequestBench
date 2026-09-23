"""Writes the OpenAPI document Starlette's SchemaGenerator builds from the routes to
Client/openapi.json.

SchemaGenerator walks the routes, Mounts included, and reads each endpoint's docstring as YAML: the
operation for that path and method. An endpoint with no YAML docstring is left out. The components
the docstrings refer to are declared below, in the base schema SchemaGenerator starts from, as
Starlette's documentation passes the title and version. Nothing listens.
"""
import json
import os
import sys
from pathlib import Path

import yaml
from starlette.schemas import SchemaGenerator

CLIENT = Path(__file__).resolve().parent
sys.path.insert(0, str(CLIENT.parent / "Implementation"))

from app import build  # noqa: E402
from payloads import load  # noqa: E402

COMPONENTS = yaml.safe_load("""
securitySchemes:
  bearer: {type: http, scheme: bearer}
responses:
  NotFound:
    description: No row has the id. Starlette's 404, as text.
    content: {text/plain: {schema: {type: string}}}
  Refused:
    description: SpecTree's 422, with Pydantic's failures, or with error_msg for a body that is not JSON.
    content:
      application/json:
        schema:
          oneOf:
            - {$ref: "#/components/schemas/Failures"}
            - {$ref: "#/components/schemas/Unparsed"}
schemas:
  Item:
    type: object
    required: [id, name, category, priceCents, inStock]
    properties:
      id: {type: integer}
      name: {type: string}
      category: {type: string}
      priceCents: {type: integer}
      inStock: {type: boolean}
  Payload:
    type: object
    required: [size, count, items]
    properties:
      size: {type: string}
      count: {type: integer}
      items: {type: array, items: {$ref: "#/components/schemas/Item"}}
  EchoedOne:
    allOf:
      - {$ref: "#/components/schemas/Payload"}
      - type: object
        required: [echo]
        properties:
          echo: {type: object, required: [one], properties: {one: {type: integer}}}
  EchoedTwo:
    allOf:
      - {$ref: "#/components/schemas/Payload"}
      - type: object
        required: [echo]
        properties:
          echo: {type: object, required: [one, two], properties: {one: {type: integer}, two: {type: integer}}}
  EchoedPage:
    allOf:
      - {$ref: "#/components/schemas/Payload"}
      - type: object
        required: [echo]
        properties:
          echo: {type: object, required: [page], properties: {page: {type: integer}}}
  EchoedSearch:
    allOf:
      - {$ref: "#/components/schemas/Payload"}
      - type: object
        required: [echo]
        properties:
          echo: {$ref: "#/components/schemas/Search"}
  EchoedHeaders:
    allOf:
      - {$ref: "#/components/schemas/Payload"}
      - type: object
        required: [echo]
        properties:
          echo:
            type: object
            required: [tenant, requestId, account]
            properties: {tenant: {type: string}, requestId: {type: string}, account: {type: integer}}
  Search:
    type: object
    required: [page, size, status, category, sort, q, minPrice, maxPrice]
    properties:
      page: {type: integer}
      size: {type: integer}
      status: {type: string}
      category: {type: string}
      sort: {type: string}
      q: {type: string}
      minPrice: {type: integer}
      maxPrice: {type: integer}
  Line:
    type: object
    required: [productId, qty]
    properties: {productId: {type: integer}, qty: {type: integer}}
  Order:
    type: object
    required: [customerId, status, lines]
    properties:
      customerId: {type: integer}
      status: {type: string}
      lines: {type: array, items: {$ref: "#/components/schemas/Line"}}
  CheckedLine:
    type: object
    required: [productId, qty]
    properties: {productId: {type: integer, exclusiveMinimum: 0}, qty: {type: integer, exclusiveMinimum: 0}}
  CheckedOrder:
    type: object
    required: [customerId, status, lines]
    properties:
      customerId: {type: integer, exclusiveMinimum: 0}
      status: {type: string, minLength: 1}
      lines: {type: array, minItems: 1, items: {$ref: "#/components/schemas/CheckedLine"}}
  Bound:
    type: object
    required: [fields, bytes, echo]
    properties:
      fields: {type: integer}
      bytes: {type: integer}
      echo: {$ref: "#/components/schemas/Order"}
  NewItem:
    type: object
    required: [name, category, priceCents, inStock]
    properties:
      name: {type: string}
      category: {type: string}
      priceCents: {type: integer}
      inStock: {type: boolean}
  ItemPatch:
    type: object
    properties: {priceCents: {type: integer}, inStock: {type: boolean}}
  Upload:
    type: object
    required: [tenant, requestId, file]
    properties:
      tenant: {type: string}
      requestId: {type: string}
      file: {type: string, format: binary}
  Uploaded:
    type: object
    required: [file, echo]
    properties:
      file: {type: object, required: [name, bytes], properties: {name: {type: string}, bytes: {type: integer}}}
      echo: {type: object, required: [tenant, requestId], properties: {tenant: {type: string}, requestId: {type: string}}}
  Failures:
    type: array
    items:
      type: object
      required: [type, loc, msg]
      properties:
        type: {type: string}
        loc: {type: array, items: {oneOf: [{type: string}, {type: integer}]}}
        msg: {type: string}
        input: {}
        url: {type: string}
  Unparsed:
    type: object
    required: [error_msg]
    properties: {error_msg: {type: string}}
  Meta:
    type: object
    required: [framework, version, runtime, adapter, serializer, workers]
    properties:
      framework: {type: string}
      version: {type: string}
      runtime: {type: string}
      adapter: {type: string}
      serializer: {type: string}
      workers: {type: integer}
""")

SCHEMAS = SchemaGenerator({
    "openapi": "3.1.0",
    "info": {"title": "RequestBench Starlette", "version": "1.0.0"},
    "components": COMPONENTS,
})

if "RB_PAYLOADS" not in os.environ:
    sys.exit("RB_PAYLOADS has to name the payload directory")

document = SCHEMAS.get_schema(routes=build(load(os.environ["RB_PAYLOADS"])).routes)
(CLIENT / "openapi.json").write_text(json.dumps(document, indent=2) + "\n")
