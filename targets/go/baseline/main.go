// RequestBench bare baseline for Go. No framework, no router library.
//
// Routing returns a transport-free Result (see routes.go), so the same routing serves
// three hosts without one wrapping another:
//
//   container / gcp-func   an http.Handler
//   lambda-rie             an API Gateway v2 event handler, no HTTP in the process
//
// The Lambda path is hand-written rather than an httpadapter shim over the HTTP path,
// because a bare baseline has to be the floor for its host rather than a translation of
// another host's floor.
package main

import (
	"encoding/json"
	"log"
	"net/http"
	"os"
	"runtime"
	"strings"

	hosts "github.com/ianjohnson/requestbench/targets/go/_hosts"
	d "github.com/ianjohnson/requestbench/targets/go/_shared"
)

func meta() map[string]string {
	return map[string]string{"framework": "net/http", "version": runtime.Version(),
		"runtime": runtime.Version()}
}

func split(path string) []string {
	out := make([]string, 0, 8)
	for _, s := range strings.Split(path, "/") {
		if s != "" {
			out = append(out, s)
		}
	}
	return out
}

var hasBody = map[string]bool{"POST": true, "PUT": true, "PATCH": true}

// ---- transport: an http.Handler ------------------------------------------------------

func write(w http.ResponseWriter, r Result) {
	var buf []byte
	switch b := r.Body.(type) {
	case nil:
	case string:
		buf = []byte(b)
	default:
		var err error
		if buf, err = json.Marshal(b); err != nil {
			w.WriteHeader(500)
			return
		}
	}
	for k, v := range r.Headers {
		w.Header().Set(k, v)
	}
	if r.Status != 204 {
		w.Header().Set("content-length", itoa(len(buf)))
	}
	w.WriteHeader(r.Status)
	if r.Status != 204 {
		w.Write(buf)
	}
}

func handler(w http.ResponseWriter, r *http.Request) {
	defer func() {
		if v := recover(); v != nil {
			msg := "internal"
			if e, isErr := v.(error); isErr {
				msg = e.Error()
			}
			write(w, jsonRes(500, map[string]string{"error": "internal", "message": msg}))
		}
	}()
	var body map[string]any
	if hasBody[r.Method] {
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			write(w, onError(&d.ValidationError{
				Errors: []d.FieldError{{Field: "body", Rule: "json"}}}))
			return
		}
	}
	write(w, Route(r.Method, split(r.URL.Path), r.URL.Query(), body))
}

func main() {
	fx := os.Getenv("RB_FIXTURE")
	if fx == "" {
		fx = "../../spec/fixture.json"
	}
	if err := d.Load(fx); err != nil {
		log.Fatalf("fixture: %v", err)
	}
	hosts.Serve("baseline", http.HandlerFunc(handler), lambdaHandler)
}
