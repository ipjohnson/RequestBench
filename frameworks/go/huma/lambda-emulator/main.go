// The function: the payloads loaded from RB_PAYLOADS, then the ServeMux Huma registers its operations on,
// behind aws-lambda-go-api-proxy's httpadapter, which aws-lambda-go's runtime hands each event to.
package main

import (
	"log"
	"os"

	"github.com/aws/aws-lambda-go/lambda"
	"github.com/awslabs/aws-lambda-go-api-proxy/httpadapter"

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
	implementation.Adapter = "humago behind aws-lambda-go-api-proxy httpadapter"
	mux, _ := implementation.New(payloads)
	// Huma has no Lambda adapter of its own. httpadapter is aws-lambda-go-api-proxy's adapter for a plain
	// http.Handler, and NewV2 reads API Gateway payload format 2.0, the event a Function URL sends.
	lambda.Start(httpadapter.NewV2(mux).ProxyWithContext)
}
