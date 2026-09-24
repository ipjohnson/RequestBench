package implementation

import (
	"io"
	"net/http"
	"runtime"
	"runtime/debug"
	"strings"

	"github.com/gorilla/mux"
)

// Adapter names what hands the application its requests. It is net/http's server unless the
// host's main package says otherwise.
var Adapter = "net/http"

// contractRoutes answers /health and /__meta, which the contract asks of every framework
// outside the corpus.
func contractRoutes(r *mux.Router) {
	// The payloads are loaded before the server listens, so a server that answers has them.
	r.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/plain; charset=utf-8")
		_, _ = io.WriteString(w, "ok")
	}).Methods(http.MethodGet)

	version := moduleVersion("github.com/gorilla/mux")
	r.HandleFunc("/__meta", func(w http.ResponseWriter, r *http.Request) {
		respond(w, http.StatusOK, map[string]any{
			"framework":  "gorilla/mux",
			"version":    version,
			"runtime":    runtime.Version(),
			"adapter":    Adapter,
			"serializer": "encoding/json",
			// Go sets this from the container's CPU quota, so it says how many threads run Go code.
			"gomaxprocs": runtime.GOMAXPROCS(0),
		})
	}).Methods(http.MethodGet)
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
