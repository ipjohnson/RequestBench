// headers: eager against lazy construction of the request header map.
//
// The handler reads no header at all, so headers.many minus headers.few is the cost of
// materialising 27 nobody asked for.
package main

import "github.com/gorilla/mux"

func registerHeaders(r *mux.Router) {
	r.Handle("/headers", payload("small")).Methods("GET")
}
