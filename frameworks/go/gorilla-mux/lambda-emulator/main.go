// The function: the payloads loaded from RB_PAYLOADS, then the router behind aws-lambda-go-api-proxy's
// httpadapter, which aws-lambda-go's runtime hands each event to.
package main

import (
	"log"
	"os"

	"github.com/aws/aws-lambda-go/lambda"
	"github.com/awslabs/aws-lambda-go-api-proxy/httpadapter"

	implementation "github.com/ipjohnson/RequestBench/frameworks/go/gorilla-mux/Implementation"
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
	// aws-lambda-go-api-proxy's gorillamux adapter takes a bare *mux.Router, and the router comes
	// wrapped in gorilla/handlers' RecoveryHandler. httpadapter hands each request to any
	// http.Handler's ServeHTTP, as gorillamux does to the router's. NewV2 reads API Gateway payload
	// format 2.0, the event a Function URL sends.
	lambda.Start(httpadapter.NewV2(implementation.Router(payloads)).ProxyWithContext)
}
