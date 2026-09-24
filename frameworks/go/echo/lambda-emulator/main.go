// The function: the payloads loaded from RB_PAYLOADS, then the instance behind aws-lambda-go-api-proxy's
// httpadapter, which aws-lambda-go's runtime hands each event to.
package main

import (
	"log"
	"os"

	"github.com/aws/aws-lambda-go/lambda"
	"github.com/awslabs/aws-lambda-go-api-proxy/httpadapter"

	implementation "github.com/ipjohnson/RequestBench/frameworks/go/echo/Implementation"
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
	e := implementation.Router(payloads)
	implementation.Adapter = "aws-lambda-go-api-proxy httpadapter"
	// aws-lambda-go-api-proxy's echoadapter takes an echo v4 instance, and hands each request to its
	// ServeHTTP. httpadapter does the same for any http.Handler, which a v5 instance is. NewV2 reads
	// API Gateway payload format 2.0, the event a Function URL sends.
	lambda.Start(httpadapter.NewV2(e).ProxyWithContext)
}
