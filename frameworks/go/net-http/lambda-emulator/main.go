// The function: the payloads loaded from RB_PAYLOADS, then the ServeMux behind
// aws-lambda-go-api-proxy's httpadapter, which aws-lambda-go's runtime hands each event to.
package main

import (
	"log"
	"os"

	"github.com/aws/aws-lambda-go/lambda"
	"github.com/awslabs/aws-lambda-go-api-proxy/httpadapter"

	implementation "github.com/ipjohnson/RequestBench/frameworks/go/net-http/Implementation"
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
	implementation.Adapter = "aws-lambda-go-api-proxy httpadapter"
	// httpadapter is the library's adapter for a plain http.Handler. NewV2 reads API Gateway payload
	// format 2.0, the event a Function URL sends.
	lambda.Start(httpadapter.NewV2(implementation.Mux(payloads)).ProxyWithContext)
}
