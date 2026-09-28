package implementation

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/render"
)

// authorizedRoutes put a middleware in front of the handler that refuses any bearer token but
// the one it is given. chi ships basic authentication and nothing for a bearer token, so the
// middleware is the application's, written as chi's README writes its AdminOnly middleware.
func authorizedRoutes(r chi.Router, p *Payloads) {
	r.With(requireToken("5a7cc77ed0dcb825806b6f872026c317")).Get("/authorized/small", func(w http.ResponseWriter, r *http.Request) { render.JSON(w, r, &p.Small) })
}

// rb:wiring authorized.*
func requireToken(token string) func(http.Handler) http.Handler {
	expected := "Bearer " + token
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if r.Header.Get("Authorization") != expected {
				http.Error(w, http.StatusText(http.StatusForbidden), http.StatusForbidden)
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}
