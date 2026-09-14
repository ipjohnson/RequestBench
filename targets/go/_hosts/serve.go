// Package hosts starts a target under whichever execution host was asked for.
//
// A target builds an http.Handler and hands it over; the host decides what invokes it.
// container listens on PORT directly, which is also the Cloud Run contract and therefore
// covers Fargate, ECS and plain Docker unchanged. gcp-func hands the same handler to the
// Functions Framework, the library Cloud Run functions actually runs.
//
// lambda-rie is not here: it needs a different binary and a different base image, so it
// lives behind a build tag in each target.
package hosts

import (
	"log"
	"net/http"
	"os"

	"github.com/GoogleCloudPlatform/functions-framework-go/funcframework"
	"github.com/GoogleCloudPlatform/functions-framework-go/functions"
)

func port() string {
	if p := os.Getenv("PORT"); p != "" {
		return p
	}
	return "8080"
}

// Serve blocks, running h under the host named by RB_HOST.
func Serve(name string, h http.Handler) {
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
	default:
		log.Fatalf("go has no launcher for host %q", host)
	}
}
