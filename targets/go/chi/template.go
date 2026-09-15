// template: server-side rendering of the same model the json family serializes.
//
// The engine is html/template, shared with every other Go target and named on /__meta.
package main

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	hosts "github.com/ianjohnson/requestbench/targets/go/_hosts"
	d "github.com/ianjohnson/requestbench/targets/go/_shared"
)

func templateRoute(size string) http.HandlerFunc {
	body := d.Payload(size)
	return func(w http.ResponseWriter, _ *http.Request) {
		out := hosts.RenderItems(body)
		w.Header().Set("content-type", "text/html; charset=utf-8")
		w.Header().Set("content-length", itoa(len(out)))
		_, _ = w.Write([]byte(out))
	}
}

func registerTemplate(r chi.Router) {
	r.Get("/template/small", templateRoute("small"))

	r.Get("/template/medium", templateRoute("medium"))
}
