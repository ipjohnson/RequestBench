// authorized: the framework's authorization mechanism, crypto excluded.
//
// Route-scoped middleware, not an if in the handler. An if would measure the language;
// the point of the family is the framework's own plumbing.
package main

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	d "github.com/ianjohnson/requestbench/targets/go/_shared"
)

// rb:wiring authorized.*
func requireToken(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		if !d.TokenOK(req.Header.Get("authorization")) {
			writeJSON(w, 403, d.ForbiddenBody())
			return
		}
		next.ServeHTTP(w, req)
	})
}

func registerAuthorized(r chi.Router) {
	r.With(requireToken).Get("/authorized/small", payload("small"))
}
