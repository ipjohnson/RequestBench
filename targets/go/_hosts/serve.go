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
	"runtime"
	"runtime/debug"
	"strings"

	"github.com/GoogleCloudPlatform/functions-framework-go/funcframework"
	"github.com/GoogleCloudPlatform/functions-framework-go/functions"
	"github.com/aws/aws-lambda-go/lambda"
	"github.com/awslabs/aws-lambda-go-api-proxy/httpadapter"
)

// adapters is what sits between the host and the framework, filled in by Serve. It is not
// a constant because which adapter a target gets depends on the host and on whether the
// target brought a native handler.
var adapters []string

// ModVersion reads a dependency's version out of the build info the binary carries, so it
// is whatever go.mod resolved rather than a constant kept current by hand.
func ModVersion(prefix string) string {
	info, ok := debug.ReadBuildInfo()
	if !ok {
		return ""
	}
	for _, m := range info.Deps {
		if strings.HasPrefix(m.Path, prefix) {
			return m.Version
		}
	}
	return ""
}

// mod renders a module as "name version", short enough to read on a chart label.
func mod(path string) string {
	name := path[strings.LastIndex(path, "/")+1:]
	if v := ModVersion(path); v != "" {
		return name + " " + v
	}
	return name
}

// Meta is what a target answers on /__meta.
//
// adapter is there because a host adapter can move a target's numbers with the framework
// version unchanged, and then nothing recorded explains the step. It is empty under
// container, where the framework serves its own requests.
func Meta(framework, version string) map[string]string {
	return map[string]string{
		"framework": framework,
		"version":   version,
		"runtime":   runtime.Version(),
		"adapter":   strings.Join(adapters, " + "),
	}
}

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
		adapters = []string{mod("github.com/GoogleCloudPlatform/functions-framework-go")}
		functions.HTTP("rb", h.ServeHTTP)
		// Start picks the registered function out of FUNCTION_TARGET and serves a 404 on
		// every path when it is unset, so the binary names its own function rather than
		// depending on whoever launched it to know.
		if err := os.Setenv("FUNCTION_TARGET", "rb"); err != nil {
			log.Fatalf("FUNCTION_TARGET: %v", err)
		}
		log.Printf("gcp-func/%s listening on %s", name, port())
		log.Fatal(funcframework.Start(port()))
	case "lambda-rie":
		// The runtime client is in every target's path on this host, the adapter only in
		// the ones that did not bring their own handler.
		adapters = []string{mod("github.com/aws/aws-lambda-go")}
		if native != nil {
			log.Printf("lambda-rie/%s starting (native handler)", name)
			lambda.Start(native)
			return
		}
		adapters = append(adapters, mod("github.com/awslabs/aws-lambda-go-api-proxy"))
		log.Printf("lambda-rie/%s starting (httpadapter)", name)
		lambda.Start(httpadapter.NewV2(h).ProxyWithContext)
	default:
		log.Fatalf("go has no launcher for host %q", host)
	}
}
