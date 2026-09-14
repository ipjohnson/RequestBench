// Package hosts starts a target under whichever execution host was asked for.
//
// A target builds an http.Handler and hands it over; the host decides what invokes it.
// container listens on PORT directly, which is also the Cloud Run contract and therefore
// covers Fargate, ECS and plain Docker unchanged. gcp-func hands the same handler to the
// Functions Framework, the library Cloud Run functions actually runs.
//
// lambda-rie is here too, from the same binary: RIE sets AWS_LAMBDA_RUNTIME_API and the
// runtime client connects to it, so only the base image differs. A target that has a
// native event handler passes one; the rest are wrapped with httpadapter, which is what
// people actually deploy when they keep their http.Handler.
package hosts

import (
	"log"
	"net/http"
	"os"

	"github.com/GoogleCloudPlatform/functions-framework-go/funcframework"
	"github.com/GoogleCloudPlatform/functions-framework-go/functions"
	"github.com/aws/aws-lambda-go/lambda"
	"github.com/awslabs/aws-lambda-go-api-proxy/httpadapter"
)

func port() string {
	if p := os.Getenv("PORT"); p != "" {
		return p
	}
	return "8080"
}

// Serve blocks, running h under the host named by RB_HOST.
//
// native is optional: pass a Lambda handler to be invoked directly, or nil to have the
// http.Handler wrapped by httpadapter. The bare baseline passes one so its Lambda numbers
// are a floor rather than a measurement of the adapter.
func Serve(name string, h http.Handler, native any) {
	host := os.Getenv("RB_HOST")
	if host == "" {
		host = "container"
	}
	switch host {
	case "container":
		log.Printf("container/%s listening on %s", name, port())
		log.Fatal(http.ListenAndServe(":"+port(), h))
	case "gcp-func":
		functions.HTTP("rb", h.ServeHTTP)
		log.Printf("gcp-func/%s listening on %s", name, port())
		log.Fatal(funcframework.Start(port()))
	case "lambda-rie":
		if native != nil {
			log.Printf("lambda-rie/%s starting (native handler)", name)
			lambda.Start(native)
			return
		}
		log.Printf("lambda-rie/%s starting (httpadapter)", name)
		lambda.Start(httpadapter.NewV2(h).ProxyWithContext)
	default:
		log.Fatalf("go has no launcher for host %q", host)
	}
}
