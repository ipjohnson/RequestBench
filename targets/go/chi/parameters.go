// parameters: router captures with segment depth held constant, each bound as an integer and
// echoed.
//
// chi has no binder here either: chi.URLParam hands back a capture as a string and the
// conversion is the handler's own work. A capture that is not a number converts to zero, as a
// query parameter does here.
//
// chi's tree prefers a literal segment to a capture, so the static route keeps its own request
// whatever order the routes are registered in.
package main

import (
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	d "github.com/ianjohnson/requestbench/targets/go/_shared"
)

// rb:wiring parameters.*
type oneCapture struct {
	One int `json:"one"`
}

// rb:wiring parameters.*
type twoCaptures struct {
	One int `json:"one"`
	Two int `json:"two"`
}

func registerParameters(r chi.Router) {
	r.Get("/parameters/static/segment/literal", payload("small"))

	r.Get("/parameters/{one}/segment/literal", func(w http.ResponseWriter, req *http.Request) {
		one, _ := strconv.Atoi(chi.URLParam(req, "one"))
		writeJSON(w, 200, d.WithEcho("small", oneCapture{One: one}))
	})

	r.Get("/parameters/{one}/with-second/{two}", func(w http.ResponseWriter, req *http.Request) {
		one, _ := strconv.Atoi(chi.URLParam(req, "one"))
		two, _ := strconv.Atoi(chi.URLParam(req, "two"))
		writeJSON(w, 200, d.WithEcho("small", twoCaptures{One: one, Two: two}))
	})
}
