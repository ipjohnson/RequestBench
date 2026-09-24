// The function: the payloads loaded from RB_PAYLOADS, then the app behind Fiber's adaptor and
// aws-lambda-go-api-proxy's httpadapter, which aws-lambda-go's runtime hands each event to.
package main

import (
	"log"
	"os"

	"github.com/aws/aws-lambda-go/lambda"
	"github.com/awslabs/aws-lambda-go-api-proxy/httpadapter"
	"github.com/gofiber/fiber/v3/middleware/adaptor"

	implementation "github.com/ipjohnson/RequestBench/frameworks/go/fiber/Implementation"
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
	app := implementation.App(payloads)
	implementation.Adapter = "Fiber's adaptor, under aws-lambda-go-api-proxy httpadapter"
	// aws-lambda-go-api-proxy's fiberadapter takes only a fiber v2 app. adaptor.FiberApp, Fiber's
	// own net/http handler over an app, does for v3 what fiberadapter does for v2, and httpadapter
	// hands it each event as a net/http request. NewV2 reads API Gateway payload format 2.0, the
	// event a Function URL sends.
	lambda.Start(httpadapter.NewV2(adaptor.FiberApp(app)).ProxyWithContext)
}
