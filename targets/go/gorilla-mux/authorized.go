// authorized: the framework's authorization mechanism, crypto excluded.
//
// A middleware wrapping this one route, not an if in the handler. An if would measure the
// language; the point of the family is the framework's own plumbing.
package main

import (
	"net/http"

	"github.com/gorilla/mux"
	d "github.com/ianjohnson/requestbench/targets/go/_shared"
)

func requireToken(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		if !d.TokenOK(req.Header.Get("authorization")) {
			writeJSON(w, 403, d.ForbiddenBody())
			return
		}
		next.ServeHTTP(w, req)
	})
}

func registerAuthorized(r *mux.Router) {
	r.Handle("/authorized/small", chain(payload("small"), requireToken)).Methods("GET")
}
