package implementation

import (
	"net/http"
	"runtime"
	"runtime/debug"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/render"
)

// Adapter names what hands the application its requests. It is net/http's server unless the
// host's main package says otherwise.
var Adapter = "net/http"

// contractRoutes answers /health and /__meta, which the contract asks of every framework
// outside the corpus.
func contractRoutes(r chi.Router) {
	// The payloads are loaded before the server listens, so a server that answers has them.
	r.Get("/health", func(w http.ResponseWriter, r *http.Request) { render.PlainText(w, r, "ok") })

	version := moduleVersion("github.com/go-chi/chi/v5")
	r.Get("/__meta", func(w http.ResponseWriter, r *http.Request) {
		render.JSON(w, r, render.M{
			"framework": "chi",
			"version":   version,
			"runtime":   runtime.Version(),
			"adapter":   Adapter,
			// render.JSON encodes with encoding/json.
			"serializer": "encoding/json",
			// Go sets this from the container's CPU quota, so it says how many threads run Go code.
			"gomaxprocs": runtime.GOMAXPROCS(0),
		})
	})
}

// moduleVersion is the version of a module the build resolved, without the v Go puts in front of it.
func moduleVersion(path string) string {
	if info, ok := debug.ReadBuildInfo(); ok {
		for _, dep := range info.Deps {
			if dep.Path == path {
				return strings.TrimPrefix(dep.Version, "v")
			}
		}
	}
	return "unknown"
}
