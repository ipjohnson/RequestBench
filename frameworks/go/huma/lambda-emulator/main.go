// The function: the payloads loaded from RB_PAYLOADS, then the ServeMux Huma registers its operations on,
// behind two adapters. The sse and stream routes go out through aws-lambda-go's lambdaurl, which
// streams the answer, and every other request through aws-lambda-go-api-proxy's httpadapter, which
// answers it whole.
package main

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/aws/aws-lambda-go/events"
	"github.com/aws/aws-lambda-go/lambda"
	"github.com/aws/aws-lambda-go/lambdaurl"
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
	implementation.Adapter = "humago behind aws-lambda-go-api-proxy httpadapter, and aws-lambda-go lambdaurl for sse and stream"
	mux, _ := implementation.New(payloads)
	// Huma has no Lambda adapter of its own. httpadapter is aws-lambda-go-api-proxy's adapter for a plain
	// http.Handler, and NewV2 reads API Gateway payload format 2.0, the event a Function URL sends.
	buffered := httpadapter.NewV2(mux)
	streamed := lambdaurl.Wrap(flushing{mux})
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

// flushing hands the ServeMux a response writer with the Flush that lambdaurl's lacks. Huma skips a flush where the
// writer has none, so the answers would stream without it, and with it Huma flushes each event as on
// the other hosts.
// lambdaurl's writer puts each write straight into the pipe the runtime client posts from, and the
// client sends each chunk at once, so Flush has nothing to do.
type flushing struct{ http.Handler }

func (f flushing) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	f.Handler.ServeHTTP(flusher{w}, r)
}

type flusher struct{ http.ResponseWriter }

func (flusher) Flush() {}

// SetWriteDeadline is for Huma's sse package, which sets a deadline before each event and logs a line
// when the writer has no way to. lambdaurl's writer has no connection to set one on, and the
// invocation's own timeout bounds the answer.
func (flusher) SetWriteDeadline(time.Time) error { return nil }
