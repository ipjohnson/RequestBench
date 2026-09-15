// query: query string parsing and coercion, isolated from any use of the values.
//
// net/http parses r.URL.Query(), which is the work this family measures; the domain
// coerces what it parsed, so every target in the language answers the same values.
package main

import (
	"net/http"

	"github.com/gorilla/mux"
	d "github.com/ianjohnson/requestbench/targets/go/_shared"
)

func registerQuery(r *mux.Router) {
	r.HandleFunc("/query/one", func(w http.ResponseWriter, req *http.Request) {
		writeJSON(w, 200, d.CoerceOne(req.URL.Query()))
	}).Methods("GET")

	r.HandleFunc("/query/many", func(w http.ResponseWriter, req *http.Request) {
		writeJSON(w, 200, d.CoerceMany(req.URL.Query()))
	}).Methods("GET")
}
