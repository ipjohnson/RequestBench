// The function: the payloads loaded from RB_PAYLOADS, then the router behind aws-lambda-go-api-proxy's
// httpadapter, which aws-lambda-go's runtime hands each event to.
package main

import (
	"log"
	"os"

	"github.com/aws/aws-lambda-go/lambda"
	"github.com/awslabs/aws-lambda-go-api-proxy/httpadapter"
	implementation "github.com/ipjohnson/RequestBench/frameworks/go/chi/Implementation"
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
	router, err := implementation.Router(payloads)
	if err != nil {
		log.Fatal(err)
	}
	// NewV2 reads API Gateway payload format 2.0, the event a Function URL sends.
	lambda.Start(httpadapter.NewV2(router).ProxyWithContext)
}
