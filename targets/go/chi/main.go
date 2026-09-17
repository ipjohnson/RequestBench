// RequestBench target: chi. Framework wiring only; behaviour from _shared.
//
// One file per endpoint family. Go puts every file in a directory into one package, so the
// families sit beside main.go rather than under it; each exports a register function.
//
// chi routes plain net/http handlers, so this target writes its own responses. Every
// feature family still uses chi's own facility -- a route-scoped middleware through
// r.With -- rather than an if in the handler.
package main

import (
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"os"

	"github.com/go-chi/chi/v5"
	hosts "github.com/ianjohnson/requestbench/targets/go/_hosts"
	d "github.com/ianjohnson/requestbench/targets/go/_shared"
)

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("content-type", "application/json; charset=utf-8")
	buf, err := json.Marshal(v)
	if err != nil {
		http.Error(w, err.Error(), 500)
		return
	}
	w.Header().Set("content-length", itoa(len(buf)))
	w.WriteHeader(status)
	_, _ = w.Write(buf)
}

func fail(w http.ResponseWriter, err error) {
	if errors.Is(err, d.ErrNotFound) {
		writeJSON(w, 404, d.NotFoundBody())
		return
	}
	writeJSON(w, 500, map[string]string{"error": "internal", "message": err.Error()})
}

func send(w http.ResponseWriter, v any, err error, status int) {
	if err != nil {
		fail(w, err)
		return
	}
	writeJSON(w, status, v)
}

func main() {
	fx := os.Getenv("RB_FIXTURE")
	if fx == "" {
		fx = "../../spec/fixture.json"
	}
	if err := d.Load(fx); err != nil {
		log.Fatalf("fixture: %v", err)
	}

	r := chi.NewRouter()

	// rb:snippet errors.unmatched
	r.NotFound(func(w http.ResponseWriter, _ *http.Request) { writeJSON(w, 404, d.NotFoundBody()) })

	registerBaseline(r)
	registerJSON(r)
	registerParameters(r)
	registerQuery(r)
	registerHeaders(r)
	registerMiddleware(r)
	registerAuthorized(r)
	registerCompressed(r)
	registerCached(r)
	registerBody(r)
	registerDomain(r)
	registerTemplate(r)

	hosts.Serve("chi", r, nil)
}
