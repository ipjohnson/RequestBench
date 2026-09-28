// The function: the payloads loaded from RB_PAYLOADS, then the app behind Fiber's adaptor and two
// adapters. The sse and stream routes go out through aws-lambda-go's lambdaurl, which streams the
// answer, and every other request through aws-lambda-go-api-proxy's httpadapter, which answers it
// whole.
package main

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"os"
	"strings"

	"github.com/aws/aws-lambda-go/events"
	"github.com/aws/aws-lambda-go/lambda"
	"github.com/aws/aws-lambda-go/lambdaurl"
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
	implementation.Adapter = "Fiber's adaptor, under aws-lambda-go-api-proxy httpadapter, and aws-lambda-go lambdaurl for sse and stream"
	// aws-lambda-go-api-proxy's fiberadapter takes only a fiber v2 app. adaptor.FiberApp, Fiber's
	// own net/http handler over an app, does for v3 what fiberadapter does for v2, and httpadapter
	// hands it each event as a net/http request. NewV2 reads API Gateway payload format 2.0, the
	// event a Function URL sends.
	handler := adaptor.FiberApp(app)
	buffered := httpadapter.NewV2(handler)
	streamed := lambdaurl.Wrap(flushing{handler})
	// aws-lambda-go sends an answer that is an io.Reader and no JSON as a stream, which is what
	// lambdaurl returns, and any other answer whole.
	lambda.Start(func(ctx context.Context, event json.RawMessage) (any, error) {
		var request events.APIGatewayV2HTTPRequest
		if err := json.Unmarshal(event, &request); err != nil {
			return nil, err
		}
		if !strings.HasPrefix(request.RawPath, "/sse/") && !strings.HasPrefix(request.RawPath, "/stream/") {
			return buffered.ProxyWithContext(ctx, request)
		}
		// lambdaurl reads a Function URL's event, which is the same JSON.
		var url events.LambdaFunctionURLRequest
		if err := json.Unmarshal(event, &url); err != nil {
			return nil, err
		}
		return streamed(ctx, &url)
	})
}

// flushing hands the app a response writer with the Flush that lambdaurl's lacks. Fiber's adaptor
// streams a body only into a writer that can flush, and writes it whole into any other. lambdaurl's
// writer puts each write straight into the pipe the runtime client posts from, and the client sends
// each chunk at once, so Flush has nothing to do.
type flushing struct{ http.Handler }

func (f flushing) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	// lambdaurl builds the request with http.NewRequest, which leaves RequestURI empty, and Fiber's
	// adaptor reads the path from it.
	r.RequestURI = r.URL.RequestURI()
	f.Handler.ServeHTTP(flusher{w}, r)
}

type flusher struct{ http.ResponseWriter }

func (flusher) Flush() {}
