// The function: the payloads loaded from RB_PAYLOADS, then the instance behind two adapters. The sse
// and stream routes go out through aws-lambda-go's lambdaurl, which streams the answer, and every
// other request through aws-lambda-go-api-proxy's httpadapter, which answers it whole.
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
	implementation.Adapter = "aws-lambda-go-api-proxy httpadapter, and aws-lambda-go lambdaurl for sse and stream"
	// aws-lambda-go-api-proxy's echoadapter takes an echo v4 instance, and hands each request to its
	// ServeHTTP. httpadapter does the same for any http.Handler, which a v5 instance is. NewV2 reads
	// API Gateway payload format 2.0, the event a Function URL sends.
	buffered := httpadapter.NewV2(e)
	streamed := lambdaurl.Wrap(flushing{e})
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

// flushing hands the instance a response writer with the Flush that lambdaurl's lacks. Without it the sse and stream
// handlers stop at their first flush.
// lambdaurl's writer puts each write straight into the pipe the runtime client posts from, and the
// client sends each chunk at once, so Flush has nothing to do.
type flushing struct{ http.Handler }

func (f flushing) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	f.Handler.ServeHTTP(flusher{w}, r)
}

type flusher struct{ http.ResponseWriter }

func (flusher) Flush() {}
