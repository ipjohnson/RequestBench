package implementation

import (
	"io"
	"net/http"
	"runtime"
	"strings"
)

// Adapter names what hands the application its requests. It is net/http's server unless the
// host's main package says otherwise.
var Adapter = "net/http"

// contractRoutes answer /health and /__meta, which the contract asks of every framework outside
// the corpus.
func contractRoutes(mux *http.ServeMux) {
	// The payloads are loaded before the server listens, so a server that answers has them.
	mux.HandleFunc("GET /health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/plain; charset=utf-8")
		_, _ = io.WriteString(w, "ok")
	})

	mux.HandleFunc("GET /__meta", func(w http.ResponseWriter, r *http.Request) {
		respond(w, http.StatusOK, map[string]any{
			"framework": "net/http",
			// net/http is part of the standard library, so its version is the Go release it was built with.
			"version":    strings.TrimPrefix(runtime.Version(), "go"),
			"runtime":    runtime.Version(),
			"adapter":    Adapter,
			"serializer": "encoding/json",
			// Go sets this from the container's CPU quota, so it says how many threads run Go code.
			"gomaxprocs": runtime.GOMAXPROCS(0),
		})
	})
}
