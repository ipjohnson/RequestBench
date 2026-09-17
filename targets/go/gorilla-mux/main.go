// RequestBench target: gorilla/mux. Framework wiring only; behaviour from _shared.
//
// One file per endpoint family. Go puts every file in a directory into one package, so the
// families sit beside main.go rather than under it; each exports a register function.
//
// gorilla/mux routes plain net/http handlers, so this target writes its own responses. Its
// middleware attaches to a router rather than to a route, so a family that needs scoping
// wraps the handler instead: chain() is what r.With is on chi, and it keeps the cost on the
// routes that asked for it.
package main

import (
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"os"
	"strconv"

	"github.com/gorilla/mux"
	hosts "github.com/ianjohnson/requestbench/targets/go/_hosts"
	d "github.com/ianjohnson/requestbench/targets/go/_shared"
)

func itoa(n int) string { return strconv.Itoa(n) }

// A content-length is written by hand on every response with a body, because net/http only
// fills one in for a body small enough to buffer and the gate requires the header.
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

// chain wraps one handler in the middlewares given, outermost first. mux.Use applies to a
// whole router, so this is how a single route carries a layer here.
func chain(h http.Handler, mw ...func(http.Handler) http.Handler) http.Handler {
	for i := len(mw) - 1; i >= 0; i-- {
		h = mw[i](h)
	}
	return h
}

func main() {
	fx := os.Getenv("RB_FIXTURE")
	if fx == "" {
		fx = "../../spec/fixture.json"
	}
	if err := d.Load(fx); err != nil {
		log.Fatalf("fixture: %v", err)
	}

	r := mux.NewRouter()

	// rb:snippet errors.unmatched
	r.NotFoundHandler = http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		writeJSON(w, 404, d.NotFoundBody())
	})

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

	hosts.Serve("gorilla-mux", r, nil)
}
