// baseline: dispatch floor, no serialization.
package main

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	hosts "github.com/ianjohnson/requestbench/targets/go/_hosts"
)

func writeText(w http.ResponseWriter, s string) {
	w.Header().Set("content-type", "text/plain; charset=utf-8")
	w.Header().Set("content-length", itoa(len(s)))
	_, _ = w.Write([]byte(s))
}

func registerBaseline(r chi.Router) {
	r.Get("/plaintext", func(w http.ResponseWriter, _ *http.Request) {
		writeText(w, "Hello, World!")
	})

	r.Get("/health", func(w http.ResponseWriter, _ *http.Request) { writeText(w, "ok") })

	r.Get("/__meta", func(w http.ResponseWriter, _ *http.Request) {
		writeJSON(w, 200, hosts.Meta("chi", chiVersion))
	})
}
