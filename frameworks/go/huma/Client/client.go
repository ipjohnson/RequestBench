// Package client is a Go client for the Implementation, which oapi-codegen generates from the OpenAPI
// document Huma writes, as Huma's client SDK tutorial generates one. `go generate ./Client` writes
// the document and then the client.
package client

//go:generate go run ./openapi
//go:generate go tool oapi-codegen -generate types,client -package client -o client.gen.go openapi.yaml
