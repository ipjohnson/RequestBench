// The document writer: the payloads loaded from RB_PAYLOADS, the Huma API built over them, and its
// OpenAPI document written to openapi.yaml, downgraded to OpenAPI 3.0.3 as Huma's client SDK
// tutorial writes it for oapi-codegen, which does not read 3.1 fully.
package main

import (
	"log"
	"os"

	implementation "github.com/ipjohnson/RequestBench/frameworks/go/huma/Implementation"
)

func main() {
	directory := os.Getenv("RB_PAYLOADS")
	if directory == "" {
		log.Fatal("RB_PAYLOADS has to name the payload directory")
	}
	payloads, err := implementation.Load(directory)
	if err != nil {
		log.Fatal(err)
	}
	_, api := implementation.New(payloads)
	document, err := api.OpenAPI().DowngradeYAML()
	if err != nil {
		log.Fatal(err)
	}
	if err := os.WriteFile("openapi.yaml", document, 0o644); err != nil {
		log.Fatal(err)
	}
}
