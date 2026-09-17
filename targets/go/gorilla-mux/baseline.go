// baseline: dispatch floor, no serialization.
package main

import (
	"net/http"
	"runtime/debug"

	"github.com/gorilla/mux"
	hosts "github.com/ianjohnson/requestbench/targets/go/_hosts"
)

// gorilla/mux publishes no version constant, so it is read from the build info the linker
// embeds, which is where the Go targets get every other resolved version.
var muxVersion = func() string {
	info, ok := debug.ReadBuildInfo()
	if !ok {
		return ""
	}
	for _, m := range info.Deps {
		if m.Path == "github.com/gorilla/mux" {
			return m.Version
		}
	}
	return ""
}()

func writeText(w http.ResponseWriter, s string) {
	w.Header().Set("content-type", "text/plain; charset=utf-8")
	w.Header().Set("content-length", itoa(len(s)))
	_, _ = w.Write([]byte(s))
}

func registerBaseline(r *mux.Router) {
	r.HandleFunc("/plaintext", func(w http.ResponseWriter, _ *http.Request) {
		writeText(w, "Hello, World!")
	}).Methods("GET")

	r.HandleFunc("/health", func(w http.ResponseWriter, _ *http.Request) {
		writeText(w, "ok")
	}).Methods("GET")

	r.HandleFunc("/__meta", func(w http.ResponseWriter, _ *http.Request) {
		writeJSON(w, 200, hosts.Meta("gorilla-mux", muxVersion, "html/template",
			"sha1 (net/http ships no conditional handling)",
			"net/http middleware over a shared LRU"))
	}).Methods("GET")
}
