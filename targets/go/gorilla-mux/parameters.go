// parameters: router captures with segment depth held constant.
package main

import "github.com/gorilla/mux"

func registerParameters(r *mux.Router) {
	r.Handle("/parameters/static/segment/literal", payload("small")).Methods("GET")

	r.Handle("/parameters/{one}", payload("small")).Methods("GET")

	r.Handle("/parameters/{one}/with-second/{two}", payload("small")).Methods("GET")
}
