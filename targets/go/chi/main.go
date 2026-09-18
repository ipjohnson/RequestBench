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

// rb:wiring errors.*,domain.*
func fail(w http.ResponseWriter, err error) {
	if errors.Is(err, d.ErrNotFound) {
		writeJSON(w, 404, d.NotFoundBody())
		return
	}
	writeJSON(w, 500, map[string]string{"error": "internal", "message": err.Error()})
}

// rb:wiring domain.*
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
	hosts.Serve("chi", router(), nil)
}

// router builds every route, on a router nothing is serving yet. It is its own function
// so a test can hand it requests: built inline in main(), the only way to reach it was
// to start this target on its container port. main() serves what it returns.
func router() *chi.Mux {
	r := chi.NewRouter()

	// rb:handler errors.unmatched
	r.NotFound(func(w http.ResponseWriter, _ *http.Request) { writeJSON(w, 404, d.NotFoundBody()) })

	registerBaseline(r)
	registerJSON(r)
	registerParameters(r)
	registerQuery(r)
	registerHeaders(r)
	registerMiddleware(r)
	registerAuthorized(r)
	registerCompressed(r)
	registerEtag(r)
	registerCache(r)
	registerBody(r)
	registerDomain(r)
	registerTemplate(r)
	return r
}
