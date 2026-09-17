// template: server-side rendering of the same model the json family serializes.
//
// gorilla/mux routes net/http handlers and adds no view layer, so the handler renders and
// this target holds its own template rather than reaching for one another target owns.
//
// Embedded rather than read from disk: a container image is the built binary on a bare
// alpine, so a template file beside the source would not be there to load.
package main

import (
	_ "embed"
	"html/template"
	"net/http"
	"strings"

	"github.com/gorilla/mux"
	d "github.com/ianjohnson/requestbench/targets/go/_shared"
)

// rb:wiring template.*
//go:embed views/items.tmpl
var itemsTemplate string

// Parsed once, rendered per request. A precomputed string would measure nothing.
// rb:wiring template.*
var items = template.Must(template.New("items.tmpl").Parse(itemsTemplate))

// rb:wiring template.*
func templateRoute(size string) http.HandlerFunc {
	body := d.Payload(size)
	return func(w http.ResponseWriter, _ *http.Request) {
		var out strings.Builder
		_ = items.Execute(&out, body)
		w.Header().Set("content-type", "text/html; charset=utf-8")
		w.Header().Set("content-length", itoa(out.Len()))
		_, _ = w.Write([]byte(out.String()))
	}
}

func registerTemplate(r *mux.Router) {
	r.Handle("/template/small", templateRoute("small")).Methods("GET")

	r.Handle("/template/medium", templateRoute("medium")).Methods("GET")
}
