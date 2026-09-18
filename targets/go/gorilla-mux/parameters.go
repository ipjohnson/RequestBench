// parameters: router captures with segment depth held constant, each bound as an integer and
// echoed.
//
// gorilla/mux has no binder here either: mux.Vars hands back the captures as strings and the
// conversion is the handler's own work. A capture that is not a number converts to zero, as a
// query parameter does here.
//
// mux tries routes in the order they were added. {one} matches the literal segment static as
// readily as a number, so the static route is registered first.
package main

import (
	"net/http"
	"strconv"

	"github.com/gorilla/mux"
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

func registerParameters(r *mux.Router) {
	r.Handle("/parameters/static/segment/literal", payload("small")).Methods("GET")

	r.HandleFunc("/parameters/{one}/segment/literal", func(w http.ResponseWriter, req *http.Request) {
		one, _ := strconv.Atoi(mux.Vars(req)["one"])
		writeJSON(w, 200, d.WithEcho("small", oneCapture{One: one}))
	}).Methods("GET")

	r.HandleFunc("/parameters/{one}/with-second/{two}", func(w http.ResponseWriter, req *http.Request) {
		vars := mux.Vars(req)
		one, _ := strconv.Atoi(vars["one"])
		two, _ := strconv.Atoi(vars["two"])
		writeJSON(w, 200, d.WithEcho("small", twoCaptures{One: one, Two: two}))
	}).Methods("GET")
}
