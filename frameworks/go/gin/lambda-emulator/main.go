// The function: the payloads loaded from RB_PAYLOADS, then the engine behind aws-lambda-go-api-proxy's
// ginadapter, which aws-lambda-go's runtime hands each event to.
package main

import (
	"log"
	"os"

	"github.com/aws/aws-lambda-go/lambda"
	ginadapter "github.com/awslabs/aws-lambda-go-api-proxy/gin"
	"github.com/gin-gonic/gin"

	implementation "github.com/ipjohnson/RequestBench/frameworks/go/gin/Implementation"
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
	// Before the router is built, because the template is parsed once only outside debug mode.
	gin.SetMode(gin.ReleaseMode)
	router := implementation.Router(payloads)
	// NewV2 reads API Gateway payload format 2.0, the event a Function URL sends.
	lambda.Start(ginadapter.NewV2(router).ProxyWithContext)
}
